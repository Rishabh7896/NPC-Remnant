import json
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SessionRow, MessageRow, EvidenceRow
from sqlalchemy import select
from app.schemas import CreateSessionRequest
from app.services.mission_service import INITIAL_GAME, INITIAL_MISSION
from app.services.memory_service import evidence_catalog

router=APIRouter(prefix="/api/v1/sessions",tags=["sessions"])
def session_out(row):
    return {"session_id":row.id,"npc_id":"aria","mission":json.loads(row.mission_state_json),"game_state":json.loads(row.game_state_json)}
@router.post("")
def create_session(body:CreateSessionRequest,db:Session=Depends(get_db)):
    sid=str(uuid4()); game=dict(INITIAL_GAME); mission=dict(INITIAL_MISSION)
    row=SessionRow(id=sid,player_name=body.player_name,scenario_id=body.scenario_id,game_state_json=json.dumps(game),mission_state_json=json.dumps(mission),relationship_trust=.5)
    db.add(row); evidence_catalog(db,body.scenario_id)
    db.add(MessageRow(id=str(uuid4()),session_id=sid,role="aria",content="Commander, life support is stable, but the engineering-wing sensor needs investigation. Tell me what you know. I will distinguish crew reports from verified station evidence."))
    db.commit(); return session_out(row)
@router.get("/{session_id}")
def get_session(session_id:str,db:Session=Depends(get_db)):
    row=db.get(SessionRow,session_id)
    if not row: raise HTTPException(404,"Session not found")
    return session_out(row)

@router.get("/{session_id}/messages")
def get_messages(session_id:str,db:Session=Depends(get_db)):
    row=db.get(SessionRow,session_id)
    if not row: raise HTTPException(404,"Session not found")
    items=db.scalars(select(MessageRow).where(MessageRow.session_id==session_id).order_by(MessageRow.created_at.asc())).all()
    return {"messages":[{"role":m.role,"content":m.content,"created_at":m.created_at.isoformat() if m.created_at else None} for m in items if m.role in {"player","aria"}]}
