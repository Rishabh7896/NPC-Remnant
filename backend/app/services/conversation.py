import asyncio
import hashlib
import json
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import MemoryRow, MessageRow, SessionRow
from app.services.llm_service import generate_interaction
from app.services.memory_service import get_memories, memory_dict
from app.services.run_service import initial_run
from app.stalls import STALL_BY_ID


def dialogue(db: Session, row: SessionRow, message: str, location: str, npc_id: str):
    game = json.loads(row.game_state_json)
    if game.get("game") != "after_hours_city":
        game = initial_run()
        row.game_state_json = json.dumps(game)

    stall = STALL_BY_ID.get(npc_id)
    if stall:
        character = {**stall, "place": stall["food"]}
        speaker_role = f"npc:{stall['id']}"
        player_role = f"player:{stall['id']}"
        speaker_name = stall["vendor"]
        game["place"] = stall["food"]
        if stall["id"] not in game["visited"]:
            game["visited"].append(stall["id"])
    else:
        character = {"vendor": "ARIA", "food": "plaza guide", "personality": "helpful local guide", "place": location}
        speaker_role = "aria"
        player_role = "player"
        speaker_name = "ARIA"

    db.add(MessageRow(id=str(uuid4()), session_id=row.id, role=player_role, content=message))
    db.flush()
    memory_rows = get_memories(db, row.id, limit=500)
    memories = [memory_dict(item) for item in reversed(memory_rows)]
    thread_roles = (f"player:{stall['id']}", f"npc:{stall['id']}") if stall else ("player", "aria")
    messages = db.scalars(
        select(MessageRow).where(
            MessageRow.session_id == row.id,
            MessageRow.role.in_(thread_roles),
        ).order_by(MessageRow.created_at.asc())
    ).all()
    history = [{"speaker": item.role, "text": item.content} for item in messages]

    result = asyncio.run(generate_interaction(
        message=message,
        memories=memories,
        game_state=game,
        history=history,
        character=character,
    ))

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
    }
