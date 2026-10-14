import json
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SessionRow, MessageRow
from sqlalchemy import select
from app.schemas import CreateSessionRequest
from app.services.run_service import initial_run
from app.stalls import STALLS, STALL_BY_ID

router=APIRouter(prefix="/api/v1/sessions",tags=["sessions"])
def session_out(row):
    return {"session_id":row.id,"npc_id":"aria","mission":json.loads(row.mission_state_json),"game_state":json.loads(row.game_state_json)}
@router.post("")
def create_session(body:CreateSessionRequest,db:Session=Depends(get_db)):
    sid=str(uuid4()); game=initial_run(); mission={"id":"evening_food_plaza","status":"active","step":"explore"}
    row=SessionRow(id=sid,player_name=body.player_name,scenario_id=body.scenario_id,game_state_json=json.dumps(game),mission_state_json=json.dumps(mission),relationship_trust=.5)
    db.add(row)
    db.add(MessageRow(id=str(uuid4()),session_id=sid,role="aria",content="Welcome to the plaza. Take your time, wander around, and talk to anyone whose stall catches your eye."))
    db.commit(); return session_out(row)

@router.get("/stalls")
def get_stalls():
    return {"stalls": STALLS}
@router.get("/{session_id}")
def get_session(session_id:str,db:Session=Depends(get_db)):
    row=db.get(SessionRow,session_id)
    if not row: raise HTTPException(404,"Session not found")
    return session_out(row)

@router.get("/{session_id}/messages")
def get_messages(session_id:str,npc_id:str=Query(default=""),db:Session=Depends(get_db)):
    row=db.get(SessionRow,session_id)
    if not row: raise HTTPException(404,"Session not found")
    items=db.scalars(select(MessageRow).where(MessageRow.session_id==session_id).order_by(MessageRow.created_at.asc())).all()
    result=[]
    selected_npc_id=npc_id
    for m in items:
        if selected_npc_id and m.role not in {f"player:{selected_npc_id}",f"npc:{selected_npc_id}","player:world","world"}:
            continue
        if m.role in {"player","aria","world"} or m.role.startswith("player:") or m.role.startswith("npc:"):
            speaker_id=m.role.split(":",1)[1] if m.role.startswith("npc:") else None
            is_player=m.role=="player" or m.role.startswith("player:")
            speaker=STALL_BY_ID[speaker_id]["vendor"] if speaker_id in STALL_BY_ID else None
            role="player" if is_player else "npc" if speaker_id else "aria" if m.role in {"aria","world"} else m.role
            result.append({"role":role,"speaker":speaker or ("Plaza guide" if m.role=="world" else None),"content":m.content,"created_at":m.created_at.isoformat() if m.created_at else None})
    return {"messages":result}
