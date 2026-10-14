import json, re
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import MessageRow, SessionRow
from app.services.memory_service import add_claim, get_memories, memory_dict
from app.services.llm_service import generate_reply

SAFE_CLAIM_PATTERNS=[
 (re.compile(r"(?:engineering wing|engineering-wing).{0,35}(?:safe|clear)|(?:safe|clear).{0,35}(?:engineering wing|engineering-wing)",re.I),"engineering_wing_safe","engineering_wing","is_safe","true","Engineering wing is safe."),
 (re.compile(r"(?:engineering wing|engineering-wing).{0,35}(?:dangerous|unsafe|hazard)",re.I),"engineering_wing_unsafe","engineering_wing","is_safe","false","Engineering wing may be unsafe."),
]

def dialogue(db:Session,row:SessionRow,message:str,location:str):
    game=json.loads(row.game_state_json)
    db.add(MessageRow(id=str(uuid4()),session_id=row.id,role="player",content=message))
    # Deterministic extraction for the core demo. Player-origin claims can never be authoritative.
    for pattern,key,subject,predicate,value,label in SAFE_CLAIM_PATTERNS:
        if pattern.search(message):
            add_claim(db,row.id,claim_key=key,claim_text=label,subject=subject,predicate=predicate,value=value,source_type="player_report",source_id=None,confidence=.55,authoritative=False)
            break
    mems=[memory_dict(m) for m in reversed(get_memories(db,row.id,limit=20))]
    recent=db.scalars(select(MessageRow).where(MessageRow.session_id==row.id).order_by(MessageRow.created_at.desc()).limit(12)).all()
    recent_data=[{"role":m.role,"content":m.content} for m in reversed(recent)]
    reply=__import__('asyncio').run(generate_reply(message,mems,game,recent_data))
    db.add(MessageRow(id=str(uuid4()),session_id=row.id,role="aria",content=reply))
    db.commit()
    relevant=[m for m in get_memories(db,row.id,limit=20) if m.subject=="engineering_wing"]
    proposal={"type":"inspect_sensor","reason":"Verify the crew report against station evidence."} if game.get("sensor")=="uninspected" else None
    return {"reply":reply,"memory_updates":[memory_dict(m) for m in relevant[:3]],"beliefs":[{"subject":m.subject,"predicate":m.predicate,"value":m.value,"confidence":m.confidence,"status":m.status} for m in relevant],"action_proposal":proposal,"action_result":None}
