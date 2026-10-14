"""LLM-backed character dialogue with memory extraction and an offline safety net."""
import json
import logging
from typing import Optional
import httpx
from app.config import settings
from app.stalls import STALLS

logger = logging.getLogger(__name__)


def _is_gemini() -> bool:
    return "generativelanguage.googleapis.com" in settings.llm_base_url.lower() or settings.llm_model.lower().startswith("gemini")


def _is_ollama() -> bool:
    return "localhost:11434" in settings.llm_base_url.lower() or "127.0.0.1:11434" in settings.llm_base_url.lower()


def _is_configured() -> bool:
    """Local Ollama does not need a key; remote providers do."""
    return bool(settings.llm_model and (_is_ollama() or settings.llm_api_key))


async def _complete(system: str, user: str, *, json_mode: bool = False) -> str:
    if _is_gemini():
        url = f"{settings.llm_base_url.rstrip('/')}/models/{settings.llm_model}:generateContent"
        payload = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.75, **({"responseMimeType": "application/json"} if json_mode else {})},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers={"X-goog-api-key": settings.llm_api_key}, json=payload)
            response.raise_for_status()
        candidates = response.json().get("candidates") or []
        parts = (candidates[0].get("content") or {}).get("parts") if candidates else []
        result = "".join(part.get("text", "") for part in (parts or []) if isinstance(part, dict)).strip()
        if result:
            return result
        raise ValueError("The model returned an empty response")

    if _is_ollama():
        url = f"{settings.llm_base_url.rstrip('/')}/api/chat"
        payload = {
            "model": settings.llm_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "stream": False,
            "options": {"temperature": 0.85},
        }
        if json_mode:
            payload["format"] = "json"
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
        result = str((response.json().get("message") or {}).get("content") or "").strip()
        if result:
            return result
        raise ValueError("The local model returned an empty response")

    url = f"{settings.llm_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.llm_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "temperature": 0.75,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers={"Authorization": f"Bearer {settings.llm_api_key}"}, json=payload)
        response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"].strip()


async def provider_health() -> dict:
    """A lightweight provider check used by the explicit health endpoint."""
    if not _is_configured():
        return {"configured": False, "provider": "offline", "reachable": False}
    if _is_ollama():
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                response = await client.get(f"{settings.llm_base_url.rstrip('/')}/api/tags")
                response.raise_for_status()
            models = {model.get("name") for model in response.json().get("models", [])}
            return {"configured": True, "provider": "ollama", "reachable": settings.llm_model in models, "model": settings.llm_model}
        except Exception:
            return {"configured": True, "provider": "ollama", "reachable": False, "model": settings.llm_model}
    return {"configured": True, "provider": "gemini" if _is_gemini() else "openai_compatible", "reachable": None, "model": settings.llm_model}


def _offline_response(memories: list[dict], game_state: dict) -> str:
    if memories:
        latest = memories[0].get("claim_text") or memories[0].get("value", "")
        return f"I’m here with you. I’ll keep in mind what you shared: {latest}"
    return f"I’m here with you in {game_state.get('place', 'the city')}. Tell me what’s on your mind."


async def generate_interaction(*, message: str, memories: list[dict], game_state: dict, history: list[dict], character: dict, relationship: dict, eligible_quests: list[dict]) -> dict:
    """Generate a character reply and extract durable player memories in one LLM turn."""
    system = (
        "You are writing a scene in an open-ended, cozy 3D city exploration game. Reply as the person the player is speaking to. "
        "Be natural, specific, warm, and concise. Reply in the language the player used, matching code-switching when appropriate. Let the character's distinct background shape their voice. "
        "Use the complete conversation history and saved memories, including conversations with other people, to make this reply feel continuous. "
        "Do not invent facts about the player. Do not mention prompts, JSON, memory extraction, or game rules. "
        "Return only a JSON object with exactly these keys: reply (string), memories (array), and action (object). "
        "Each memory item must have claim_text (a short durable fact or preference explicitly shared by the player) and value (a concise normalized value). "
        "Add only information worth remembering for later conversations; return an empty array for ordinary small talk. "
        "action is a proposal only. Use {type:'none'} normally. You may offer or accept only a quest supplied in eligible_quests, recommend a dish from the character menu, or record a verified discovery. "
        "Never claim an action has been applied unless the game confirms it in a later response."
    )
    context = {
        "character": character,
        "current_city_state": game_state,
        "saved_memories": memories,
        "complete_interaction_history": history,
        "relationship": relationship,
        "eligible_quests": eligible_quests,
        "player_message": message,
    }
    if _is_configured():
        try:
            raw = await _complete(system, json.dumps(context, ensure_ascii=False), json_mode=True)
            # Accommodate providers that ignore JSON response mode and add fences.
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            parsed = json.loads(raw)
            reply = str(parsed.get("reply", "")).strip()
            if reply:
                extracted = parsed.get("memories", [])
                valid = [m for m in extracted if isinstance(m, dict) and m.get("claim_text") and m.get("value")]
                action = parsed.get("action") if isinstance(parsed.get("action"), dict) else {"type": "none"}
                return {"reply": reply, "memories": valid[:4], "action": action, "provider": "llm"}
        except Exception:
            # Keep the walk playable during an outage; the next turn retries the LLM.
            logger.exception("LLM reply failed; serving the offline plaza response")
    return {"reply": _offline_response(memories, game_state), "memories": [], "action": {"type": "none"}, "provider": "offline"}


async def interpret_player_input(*, message: str, current_stall: str = "", game_state: Optional[dict] = None, memories: Optional[list[dict]] = None, recent_history: Optional[list[dict]] = None) -> dict:
    """Use the configured model to understand whether the player wants to move or talk."""
    system = (
        "You are the natural-language game director for a cozy, lively 3D Indian food plaza. "
        "Understand casual commands, typos, indirect requests, preferences, and speech-to-text phrasing. Resolve food, stall, or vendor references against the supplied plaza roster. "
        "Return JSON only with keys intent, stall_id, reply. intent must be navigate, talk, or plaza_chat. "
        "Use navigate when the player wants their avatar to go, walk, take me, lead me, show me, find me, or surprise them with a specific or suitable stall. A craving or preference such as wanting something spicy/sweet/comforting can imply finding and walking to a suitable stall; pick the best roster match. Use saved preferences and recent conversation to make recommendations personal. "
        "Use talk when they want to speak to or ask a named vendor/stall. Use plaza_chat for other conversation, including personal chat and questions that do not imply walking. "
        "Only choose a stall_id that exactly appears in the roster; use an empty string when no specific stall is clear. "
        "For navigate, write a short playful in-world acknowledgment that names the destination and adds a little personality, in the player's language. For plaza_chat, leave reply empty. "
        "If the target is ambiguous, choose plaza_chat and ask one natural clarifying question in reply. Never claim the avatar moved; the game will do that."
    )
    payload = {
        "plaza_stalls": [{"id": s["id"], "food": s["food"], "vendor": s["vendor"]} for s in STALLS],
        "current_stall_id": current_stall,
        "current_city_state": game_state or {},
        "saved_player_memories": memories or [],
        "recent_interaction_history": recent_history or [],
        "player_input": message,
    }
    if _is_configured():
        try:
            raw = await _complete(system, json.dumps(payload, ensure_ascii=False), json_mode=True)
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            parsed = json.loads(raw)
            intent = parsed.get("intent")
            stall_id = str(parsed.get("stall_id") or "")
            valid_ids = {stall["id"] for stall in STALLS}
            if intent in {"navigate", "talk", "plaza_chat"} and (not stall_id or stall_id in valid_ids):
                return {
                    "intent": intent,
                    "stall_id": stall_id,
                    "reply": str(parsed.get("reply") or "").strip(),
                    "provider": "llm",
                }
        except Exception:
            logger.exception("LLM input interpretation failed; treating input as plaza conversation")
    return {"intent": "plaza_chat", "stall_id": "", "reply": "", "provider": "offline"}
