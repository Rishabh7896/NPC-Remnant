from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.mission_service import get_session
from app.services.memory_service import get_memories,get_conflicts,memory_dict
router=APIRouter(prefix="/api/v1/sessions",tags=["memories"])
@router.get("/{session_id}/memories")
def list_memories(session_id:str,limit:int=Query(50,ge=1,le=200),db:Session=Depends(get_db)):
    if not get_session(db,session_id): raise HTTPException(404,"Session not found")
    ms=get_memories(db,session_id,limit)
    cs=get_conflicts(db,session_id)
    return {"memories":[memory_dict(m) for m in reversed(ms)],"conflicts":[{"id":c.id,"memory_a_id":c.memory_a_id,"memory_b_id":c.memory_b_id,"status":c.status,"resolution_note":c.resolution_note,"created_at":c.created_at.isoformat() if c.created_at else None} for c in cs]}
