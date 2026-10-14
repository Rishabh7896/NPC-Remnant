"""LLM-backed character dialogue with memory extraction and an offline safety net."""
import json
import logging
from typing import Optional
import httpx
from app.config import settings
from app.stalls import STALLS

logger = logging.getLogger(__name__)


def _is_ollama() -> bool:
    return "localhost:11434" in settings.llm_base_url.lower() or "127.0.0.1:11434" in settings.llm_base_url.lower()


def _is_configured() -> bool:
    """Only local Ollama running Qwen is permitted; cloud endpoints are disabled."""
    return bool(settings.llm_model and _is_ollama())


async def _complete(system: str, user: str, *, json_mode: bool = False) -> str:
    # Strictly enforce local inference; reject external cloud endpoints (Gemini, OpenAI, ChatGPT)
    if not _is_ollama():
        raise RuntimeError(
            "External cloud LLM calls (Gemini, ChatGPT, OpenAI) are strictly disabled. Only local Ollama with Qwen is permitted."
        )

    url = f"{settings.llm_base_url.rstrip('/')}/api/chat"
    payload = {
        "model": settings.llm_model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        "stream": False,
        "think": False,
        "options": {"temperature": 0.7},
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


async def provider_health() -> dict:
    """A lightweight provider check used by the explicit health endpoint."""
    if not _is_configured():
        return {"configured": False, "provider": "offline", "reachable": False}
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{settings.llm_base_url.rstrip('/')}/api/tags")
            response.raise_for_status()
        models = {model.get("name") for model in response.json().get("models", [])}
        return {"configured": True, "provider": "ollama", "reachable": settings.llm_model in models, "model": settings.llm_model}
    except Exception:
        return {"configured": True, "provider": "ollama", "reachable": False, "model": settings.llm_model}


def _offline_response(memories: list[dict], game_state: dict) -> str:
    if memories:
        latest = memories[0].get("claim_text") or memories[0].get("value", "")
        return f"I’m here with you. I’ll keep in mind what you shared: {latest}"
    return f"I’m here with you in {game_state.get('place', 'the city')}. Tell me what’s on your mind."


async def generate_interaction(
    *,
    message: str,
    memories: list[dict],
    game_state: dict,
    history: list[dict],
    character: dict,
    relationship: dict,
    eligible_quests: list[dict],
    catalog: Optional[list[dict]] = None,
    cart: Optional[dict] = None,
    wallet_balance: Optional[int] = None,
    past_orders: Optional[list[str]] = None,
) -> dict:
    """Generate in-character stall vendor reply, structured shopping intent, and extracted memories."""
    system = (
        "You are an AI-powered stall vendor in a lively Indian evening food plaza. Reply warmly and naturally in character. "
        "You sell authentic street food from your stall catalog. Use the exact product names and prices in ₹ (INR) provided. "
        "Never invent menu items, fake prices, or allergen claims not found in the catalog. "
        "You can chat, recommend dishes, explain ingredients/allergens, negotiate discounts within policy, and take orders. "
        "Return ONLY a JSON object with keys: "
        "reply (string, vendor in-character dialogue), "
        "memories (array of {claim_text, value} about the player's personal preferences), "
        "action (object with type: 'none' | 'offer_quest' | 'accept_quest' | 'recommend_dish' | 'record_discovery'), "
        "commerce_intent (string: 'general_chat' | 'product_inquiry' | 'add_to_cart' | 'remove_from_cart' | 'negotiate_discount' | 'confirm_order' | 'cancel_cart'), "
        "items (array of {product_id: string, quantity: integer, variant_id: string, add_on_ids: array of strings}), "
        "proposed_discount (integer in ₹, if offering a discount or bargaining). "
        "Rules: "
        "1. If player asks to order, buy, try, or add food, set commerce_intent='add_to_cart' and list the items. "
        "2. If player asks for a discount/bargain and you agree, set commerce_intent='negotiate_discount' and specify proposed_discount in ₹. "
        "3. If player explicitly confirms an order (e.g. 'yes', 'confirm', 'place order', 'go ahead', 'done'), set commerce_intent='confirm_order'. "
        "4. If player wants to remove an item or cancel, set commerce_intent='remove_from_cart' or 'cancel_cart'. "
        "5. If past orders are provided, acknowledge them warmly when relevant ('Welcome back! Your usual?')."
    )
    context = {
        "character": character,
        "stall_catalog": catalog or [],
        "current_cart": cart or {},
        "player_wallet_balance": wallet_balance if wallet_balance is not None else 500,
        "past_orders_at_this_stall": past_orders or [],
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
                commerce_intent = str(parsed.get("commerce_intent") or "general_chat").strip().lower()
                items_proposal = parsed.get("items") if isinstance(parsed.get("items"), list) else []
                proposed_discount = int(parsed.get("proposed_discount") or 0)
                return {
                    "reply": reply,
                    "memories": valid[:4],
                    "action": action,
                    "commerce": {
                        "intent": commerce_intent,
                        "items": items_proposal,
                        "proposed_discount": proposed_discount,
                    },
                    "provider": "llm",
                }
        except Exception:
            # Keep the walk playable during an outage; the next turn retries the LLM.
            logger.exception("LLM reply failed; serving the offline plaza response")
    return {
        "reply": _offline_response(memories, game_state),
        "memories": [],
        "action": {"type": "none"},
        "commerce": {"intent": "general_chat", "items": [], "proposed_discount": 0},
        "provider": "offline",
    }


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
