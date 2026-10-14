import asyncio
import hashlib
import json
from uuid import uuid4
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MemoryRow, MessageRow, SessionRow
from app.services.llm_service import generate_interaction, interpret_player_input
from app.services.memory_service import get_memories, get_relevant_memories, memory_dict
from app.services.gameplay_service import apply_action, eligible_quests, progress_quests_for_visit, relationship_for
from app.services.run_service import initial_run
from app.stalls import STALL_BY_ID, vendor_context
from app.data.catalog import get_stall_catalog, find_products_by_keyword, get_product
from app.services import shop_service


def _extract_quantity(msg: str) -> int:
    num_words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6}
    for word in msg.casefold().split():
        if word in num_words:
            return num_words[word]
    return 1


def handle_commerce(
    db: Session,
    session_id: str,
    vendor_id: str,
    commerce: dict,
    message: str,
) -> tuple[dict, Optional[dict], list[dict]]:
    """Authoritatively process conversational commerce from LLM proposals or deterministic fallback."""
    events = []
    receipt = None
    msg_lower = message.casefold().strip()

    intent = commerce.get("intent", "general_chat") if commerce else "general_chat"

    # Deterministic confirmation check
    confirm_phrases = ["order it", "place order", "place the order", "yes go ahead", "yes please", "confirm order", "confirm purchase", "pay now", "i'll buy it", "i will buy it"]
    if any(phrase in msg_lower for phrase in confirm_phrases) or (msg_lower in ["yes", "confirm", "done", "order"]):
        intent = "confirm_order"

    # Deterministic discount check
    discount_phrases = ["discount", "cheaper", "bargain", "kam karo", "kam kardo", "concession", "deal on price"]
    if any(phrase in msg_lower for phrase in discount_phrases):
        if intent != "confirm_order":
            intent = "negotiate_discount"

    # Deterministic cancellation check
    if any(phrase in msg_lower for phrase in ["cancel order", "cancel cart", "clear cart", "empty cart", "never mind", "forget it"]):
        intent = "cancel_cart"

    # Execute intent
    if intent == "confirm_order":
        ok, rec, note = shop_service.execute_checkout(db, session_id)
        if ok and rec:
            receipt = rec
            events.append({"type": "order_confirmed", "receipt": rec, "note": note})

    elif intent == "negotiate_discount":
        prop = commerce.get("proposed_discount", 10) or 10
        ok, cart_row, approved, note = shop_service.apply_negotiated_discount(
            db, session_id, vendor_id, proposed_discount_rupees=prop, reason="conversational_negotiation"
        )
        if ok:
            events.append({"type": "discount_applied", "discount": approved, "note": note})

    elif intent == "cancel_cart":
        shop_service.clear_cart(db, session_id)
        events.append({"type": "cart_cleared", "note": "Cart has been cleared."})

    elif intent == "remove_from_cart":
        items = commerce.get("items", [])
        for item in items:
            pid = item.get("product_id")
            if pid:
                shop_service.remove_from_cart(db, session_id, vendor_id, pid)
        events.append({"type": "cart_updated"})

    elif intent == "add_to_cart":
        items = commerce.get("items", [])
        if items:
            for item in items:
                pid = item.get("product_id")
                qty = item.get("quantity", 1)
                var_id = item.get("variant_id")
                add_ons = item.get("add_on_ids", [])
                if pid:
                    ok, _, note = shop_service.add_to_cart(
                        db, session_id, vendor_id, pid, quantity=qty, variant_id=var_id, add_on_ids=add_ons
                    )
                    if ok:
                        events.append({"type": "item_added_to_cart", "product_id": pid, "quantity": qty, "note": note})
        else:
            matches = find_products_by_keyword(message, vendor_id)
            if matches:
                chosen = matches[0]
                qty = _extract_quantity(message)
                ok, _, note = shop_service.add_to_cart(db, session_id, vendor_id, chosen["product_id"], quantity=qty)
                if ok:
                    events.append({"type": "item_added_to_cart", "product_id": chosen["product_id"], "quantity": qty, "note": note})

    elif any(kw in msg_lower for kw in ["want", "give me", "get me", "have", "add", "take", "pack", "order", "get", "buy", "can i"]) and not receipt:
        matches = find_products_by_keyword(message, vendor_id)
        if matches:
            chosen = matches[0]
            qty = _extract_quantity(message)
            ok, _, note = shop_service.add_to_cart(db, session_id, vendor_id, chosen["product_id"], quantity=qty)
            if ok:
                events.append({"type": "item_added_to_cart", "product_id": chosen["product_id"], "quantity": qty, "note": note})

    cart = shop_service.get_or_create_cart(db, session_id, vendor_id)
    cart_dict = {
        "cart_id": cart.id,
        "vendor_id": cart.vendor_id,
        "items": json.loads(cart.items_json),
        "subtotal": cart.subtotal,
        "discount_amount": cart.discount_amount,
        "total": cart.total,
        "state": cart.state,
    }
    return cart_dict, receipt, events


def dialogue(db: Session, row: SessionRow, message: str, location: str, npc_id: str):
    game = json.loads(row.game_state_json)
    if game.get("game") != "after_hours_city":
        game = initial_run()
        row.game_state_json = json.dumps(game)

    stall = STALL_BY_ID.get(npc_id)
    if stall:
        character = {**vendor_context(stall), "place": stall["food"]}
        speaker_role = f"npc:{stall['id']}"
        player_role = f"player:{stall['id']}"
        speaker_name = stall["vendor"]
        game["place"] = stall["food"]
        if stall["id"] not in game["visited"]:
            game["visited"].append(stall["id"])
        game, progress_events = progress_quests_for_visit(game, stall["id"])
        relationship = relationship_for(game, stall["id"])
        if relationship["familiarity"] == 0:
            relationship["familiarity"] = 1
    else:
        character = {"vendor": "ARIA", "food": "plaza guide", "personality": "helpful local guide", "place": location}
        speaker_role = "aria"
        player_role = "player"
        speaker_name = "ARIA"
        progress_events = []
        relationship = {"trust": 0.0, "familiarity": 0, "milestones": []}

    db.add(MessageRow(id=str(uuid4()), session_id=row.id, role=player_role, content=message))
    db.flush()
    memory_rows = get_relevant_memories(db, row.id, message, npc_id)
    memories = [memory_dict(item) for item in reversed(memory_rows)]
    context_roles = {player_role, speaker_role, "player:world", "world"}
    messages = db.scalars(
        select(MessageRow).where(
            MessageRow.session_id == row.id,
            MessageRow.role.in_(context_roles),
        ).order_by(MessageRow.created_at.desc()).limit(16)
    ).all()
    history = [{"speaker": item.role, "text": item.content} for item in reversed(messages)]

    if stall:
        catalog = get_stall_catalog(stall["id"])
        cart_row = shop_service.get_or_create_cart(db, row.id, stall["id"])
        cart_data = {
            "items": json.loads(cart_row.items_json),
            "subtotal": cart_row.subtotal,
            "discount_amount": cart_row.discount_amount,
            "total": cart_row.total,
        }
        wallet_balance = shop_service.get_wallet_balance(db, row.id)
        past_orders = shop_service.get_vendor_order_memory(db, row.id, stall["id"])
    else:
        catalog = []
        cart_data = {}
        wallet_balance = shop_service.get_wallet_balance(db, row.id)
        past_orders = []

    result = asyncio.run(generate_interaction(
        message=message,
        memories=memories,
        game_state=game,
        history=history,
        character=character,
        relationship=relationship,
        eligible_quests=eligible_quests(game, npc_id) if stall else [],
        catalog=catalog,
        cart=cart_data,
        wallet_balance=wallet_balance,
        past_orders=past_orders,
    ))
    game, action_events = apply_action(game, npc_id, result.get("action")) if stall else (game, [])

    if stall:
        cart_snapshot, receipt, commerce_events = handle_commerce(
            db, row.id, stall["id"], result.get("commerce", {}), message
        )
        if receipt:
            relationship["trust"] = min(1.0, round(relationship["trust"] + 0.15, 2))
            relationship["familiarity"] += 2
            if "Completed an order" not in relationship["milestones"]:
                relationship["milestones"].append("Completed an order")
            game["last_event"] = f"Purchased food from {speaker_name} (₹{receipt['total']})."
    else:
        cart_snapshot = None
        receipt = None
        commerce_events = []

    new_memories = []
    added_keys = set()
    for extracted in result["memories"]:
        claim_text = str(extracted["claim_text"]).strip()[:240]
        value = str(extracted["value"]).strip()[:160]
        if not claim_text or not value:
            continue
        key = hashlib.sha256(value.casefold().encode("utf-8")).hexdigest()[:16]
        claim_key = f"personal_{key}"
        if claim_key in added_keys:
            continue
        existing = db.scalars(
            select(MemoryRow).where(MemoryRow.session_id == row.id, MemoryRow.claim_key == claim_key)
        ).first()
        if existing:
            continue
        record = MemoryRow(
            id=str(uuid4()), session_id=row.id, claim_key=claim_key,
            claim_text=claim_text, subject="player", predicate=f"personal_context_{key}",
            value=value, source_type="player_report", confidence=0.82, status="remembered",
        )
        db.add(record)
        new_memories.append(record)
        added_keys.add(claim_key)

    game["last_event"] = f"You spoke with {speaker_name} at {stall['food'] if stall else 'the plaza'}."
    row.game_state_json = json.dumps(game)
    reply = result["reply"]
    db.add(MessageRow(id=str(uuid4()), session_id=row.id, role=speaker_role, content=reply))
    db.commit()

    return {
        "reply": reply,
        "npc": {"id": npc_id or "aria", "name": speaker_name},
        "memory_updates": [memory_dict(item) for item in new_memories],
        "memories": [memory_dict(item) for item in get_memories(db, row.id, limit=500)],
        "game_state": game,
        "provider": result["provider"],
        "events": progress_events + action_events + commerce_events,
        "cart": cart_snapshot,
        "wallet": {"balance": shop_service.get_wallet_balance(db, row.id), "currency": "INR"},
        "receipt": receipt,
    }


def interact(db: Session, row: SessionRow, message: str, location: str, npc_id: str = ""):
    """Interpret freeform player input, then navigate or hand it to a character."""
    recent = db.scalars(
        select(MessageRow).where(MessageRow.session_id == row.id)
        .order_by(MessageRow.created_at.desc()).limit(30)
    ).all()
    recent_history = [{"speaker": item.role, "text": item.content} for item in reversed(recent)]
    saved = [memory_dict(item) for item in reversed(get_memories(db, row.id, limit=100))]
    parsed = asyncio.run(interpret_player_input(
        message=message, current_stall=npc_id, game_state=json.loads(row.game_state_json),
        memories=saved, recent_history=recent_history,
    ))
    intent = parsed["intent"]
    target_id = parsed["stall_id"]
    if intent == "navigate" and target_id in STALL_BY_ID and target_id != npc_id:
        game = json.loads(row.game_state_json)
        game["destination"] = target_id
        game["last_event"] = f"You are heading to {STALL_BY_ID[target_id]['food']}."
        row.game_state_json = json.dumps(game)
        reply = parsed["reply"] or f"Off we go to {STALL_BY_ID[target_id]['food']}!"
        db.add(MessageRow(id=str(uuid4()), session_id=row.id, role="player:world", content=message))
        db.add(MessageRow(id=str(uuid4()), session_id=row.id, role="world", content=reply))
        db.commit()
        return {
            "intent": "navigate", "reply": reply,
            "npc": {"id": target_id, "name": "Plaza guide"}, "action": {"type": "navigate", "stall_id": target_id},
            "provider": parsed["provider"], "game_state": game,
        }

    if intent == "plaza_chat" and parsed["reply"]:
        db.add(MessageRow(id=str(uuid4()), session_id=row.id, role="player:world", content=message))
        db.add(MessageRow(id=str(uuid4()), session_id=row.id, role="world", content=parsed["reply"]))
        db.commit()
        return {
            "intent": "plaza_chat", "reply": parsed["reply"],
            "npc": {"id": "guide", "name": "Plaza guide"}, "action": {"type": "none"},
            "provider": parsed["provider"], "game_state": json.loads(row.game_state_json),
        }

    resolved_id = target_id if target_id in STALL_BY_ID else npc_id
    result = dialogue(db, row, message, location, resolved_id)
    result["intent"] = "talk" if resolved_id else "plaza_chat"
    result["action"] = {"type": "talk", "stall_id": resolved_id} if resolved_id else {"type": "none"}
    result["intent_provider"] = parsed["provider"]
    return result
