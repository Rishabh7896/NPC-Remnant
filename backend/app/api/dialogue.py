from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import DialogueRequest
from app.models import SessionRow
from app.services.conversation import dialogue, interact
router=APIRouter(prefix="/api/v1/sessions",tags=["conversations"])
@router.post("/{session_id}/dialogue")
def post_dialogue(session_id:str,body:DialogueRequest,db:Session=Depends(get_db)):
    row=db.get(SessionRow,session_id)
    if not row: raise HTTPException(404,"Session not found")
    return dialogue(db,row,body.message,body.location,body.npc_id)

@router.post("/{session_id}/interact")
def post_interaction(session_id:str,body:DialogueRequest,db:Session=Depends(get_db)):
    row=db.get(SessionRow,session_id)
    if not row: raise HTTPException(404,"Session not found")
    return interact(db,row,body.message,body.location,body.npc_id)
