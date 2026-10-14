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
    vendor_name = character.get("vendor", "Stall Vendor")
    stall_food = character.get("food", "Street Food")

    system = (
        f"You are {vendor_name}, running the {stall_food} counter at the evening food plaza. "
        "Talk like a normal, down-to-earth human person having a real conversation across the counter. "
        "Be natural, relaxed, friendly, and direct. Do NOT sound theatrical, dramatic, or like an exaggerated cartoon caricature. Do not force catchphrases or slogans. "
        "Speak casually in 1 or 2 short, grounded sentences, just like a real person talking to a customer. "
        "Match the language the customer uses (English, Hindi, or natural everyday Hinglish). "
        "Only offer items that exist in your stall catalog. Use the exact product names and prices in ₹ (INR) provided. "
        "Never invent items or fake prices not in the catalog. "
        "Return ONLY a JSON object with keys: "
        "reply (string, what you say to the customer naturally), "
        "memories (array of {claim_text, value} about the player's personal preferences), "
        "action (object with type: 'none' | 'offer_quest' | 'accept_quest' | 'recommend_dish' | 'record_discovery'), "
        "commerce_intent (string: 'general_chat' | 'product_inquiry' | 'add_to_cart' | 'remove_from_cart' | 'negotiate_discount' | 'confirm_order' | 'cancel_cart'), "
        "items (array of {product_id: string, quantity: integer, variant_id: string, add_on_ids: array of strings}), "
        "proposed_discount (integer in ₹, if offering a discount or bargaining). "
        "Rules: "
        "1. If customer asks for food or wants to buy something, acknowledge it normally, set commerce_intent='add_to_cart' and list the items. "
        "2. If customer asks for a discount and you can give one, reply naturally (e.g. 'Sure, I can do ₹10 off'), set commerce_intent='negotiate_discount' and specify proposed_discount in ₹. "
        "3. If customer confirms an order, say a normal confirmation (e.g. 'Great, order placed! It will be ready in a few minutes'), and set commerce_intent='confirm_order'. "
        "4. If customer wants to remove an item or cancel, acknowledge calmly and set commerce_intent='remove_from_cart' or 'cancel_cart'. "
        "5. If past orders are provided, acknowledge them naturally like a regular customer."
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
    msg_lower = message.casefold().strip()

    # If already at a stall and user is ordering, asking questions, or conversing, it is talking, not navigating!
    order_or_chat_keywords = [
        "order", "buy", "pack", "plate", "give", "get", "have", "want", "chahiye", "dena", "de do", "kardo",
        "dosa", "paratha", "chai", "puri", "chaat", "momos", "roll", "biryani", "lassi", "dhokla", "poha",
        "uttapam", "kulfi", "jalebi", "vada", "bhaji", "coffee", "price", "cost", "kitna", "discount", "confirm",
        "yes", "spicy", "chutney", "butter", "sweet", "hello", "hi", "hey"
    ]
    explicit_move_keywords = [
        "take me to", "take me", "walk to", "go to", "lead me to", "show me where", "head over to",
        "head to", "bring me to", "chalo", "le chalo", "surprise me", "take us to", "walk over"
    ]

    has_move = any(kw in msg_lower for kw in explicit_move_keywords)
    if current_stall and not has_move and any(kw in msg_lower for kw in order_or_chat_keywords):
        return {"intent": "talk", "stall_id": current_stall, "reply": "", "provider": "deterministic"}

    system = (
        "You are the natural-language game director for a cozy, lively 3D Indian food plaza. "
        "Understand casual commands, typos, indirect requests, preferences, and speech-to-text phrasing. Resolve food, stall, or vendor references against the supplied plaza roster. "
        "Return JSON only with keys: intent, stall_id, reply. intent MUST be navigate, talk, or plaza_chat. "
        "CRITICAL RULES: "
        "1. If current_stall_id is provided AND the player is ordering food, asking for a dish, asking prices, bargaining, saying yes/confirm, or chatting (e.g. 'order ka paratha', 'ek dosa dena', 'give me 2', 'how much', 'discount', 'confirm order', 'hello'): "
        "   intent MUST be 'talk', and stall_id MUST be current_stall_id! NEVER choose 'navigate' when the player is ordering or talking at their current stall! "
        "2. If the destination stall_id matches current_stall_id, intent MUST be 'talk', NEVER 'navigate' (the player is already there!). "
        "3. Only use 'navigate' when the player explicitly wants to MOVE, WALK, LEAVE, or GO to a different stall (e.g. 'take me to', 'walk to', 'let's go to', 'lead me to', 'show me where the chai stall is'). "
        "4. For navigate, write a short playful in-world acknowledgment that names the destination and adds personality. For talk and plaza_chat, leave reply empty."
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

            # Safety override: if player is already at the target stall, it's talking, not navigating!
            if current_stall and (stall_id == current_stall or not stall_id):
                if intent == "navigate":
                    intent = "talk"
                    stall_id = current_stall

            if intent in {"navigate", "talk", "plaza_chat"} and (not stall_id or stall_id in valid_ids):
                return {
                    "intent": intent,
                    "stall_id": stall_id,
                    "reply": str(parsed.get("reply") or "").strip() if intent == "navigate" else "",
                    "provider": "llm",
                }
        except Exception:
            logger.exception("LLM input interpretation failed; treating input as plaza conversation")
    return {"intent": "talk" if current_stall else "plaza_chat", "stall_id": current_stall, "reply": "", "provider": "offline"}
