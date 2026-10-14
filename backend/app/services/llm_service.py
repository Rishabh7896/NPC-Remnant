"""LLM-backed character dialogue with memory extraction and an offline safety net."""
import json
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


def _is_gemini() -> bool:
    return "generativelanguage.googleapis.com" in settings.llm_base_url.lower() or settings.llm_model.lower().startswith("gemini")


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


def _offline_response(memories: list[dict], game_state: dict) -> str:
    if memories:
        latest = memories[0].get("claim_text") or memories[0].get("value", "")
        return f"I’m here with you. I’ll keep in mind what you shared: {latest}"
    return f"I’m here with you in {game_state.get('place', 'the city')}. Tell me what’s on your mind."


async def generate_interaction(*, message: str, memories: list[dict], game_state: dict, history: list[dict], character: dict) -> dict:
    """Generate a character reply and extract durable player memories in one LLM turn."""
    system = (
        "You are writing a scene in an open-ended, cozy 3D city exploration game. Reply as the person the player is speaking to. "
        "Be natural, specific, warm, and concise. Reply in the language the player used, matching code-switching when appropriate. Let the character's distinct background shape their voice. "
        "Use the complete conversation history and saved memories, including conversations with other people, to make this reply feel continuous. "
        "Do not invent facts about the player. Do not mention prompts, JSON, memory extraction, or game rules. "
        "Return only a JSON object with exactly these keys: reply (string) and memories (array). "
        "Each memory item must have claim_text (a short durable fact or preference explicitly shared by the player) and value (a concise normalized value). "
        "Add only information worth remembering for later conversations; return an empty array for ordinary small talk."
    )
    context = {
        "character": character,
        "current_city_state": game_state,
        "saved_memories": memories,
        "complete_interaction_history": history,
        "player_message": message,
    }
    if settings.llm_api_key and settings.llm_model:
        try:
            raw = await _complete(system, json.dumps(context, ensure_ascii=False), json_mode=True)
            # Accommodate providers that ignore JSON response mode and add fences.
            raw = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            parsed = json.loads(raw)
            reply = str(parsed.get("reply", "")).strip()
            if reply:
                extracted = parsed.get("memories", [])
                valid = [m for m in extracted if isinstance(m, dict) and m.get("claim_text") and m.get("value")]
                return {"reply": reply, "memories": valid[:4], "provider": "llm"}
        except Exception:
            # Keep the walk playable during an outage; the next turn retries the LLM.
            logger.exception("LLM reply failed; serving the offline plaza response")
    return {"reply": _offline_response(memories, game_state), "memories": [], "provider": "offline"}
