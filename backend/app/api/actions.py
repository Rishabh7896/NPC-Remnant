from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import EvidenceRequest,ActionRequest
from app.services.mission_service import get_session,collect_evidence,perform_action
router=APIRouter(prefix="/api/v1/sessions",tags=["actions"])
@router.post("/{session_id}/evidence")
def evidence(session_id:str,body:EvidenceRequest,db:Session=Depends(get_db)):
    row=get_session(db,session_id)
    if not row: raise HTTPException(404,"Session not found")
    result=collect_evidence(db,row,body.evidence_id)
    if not result.get("accepted") and result.get("message")=="Unknown evidence item.": raise HTTPException(404,"Unknown evidence item")
    return result
@router.post("/{session_id}/actions")
def action(session_id:str,body:ActionRequest,db:Session=Depends(get_db)):
    row=get_session(db,session_id)
    if not row: raise HTTPException(404,"Session not found")
    return perform_action(db,row,body.action_type)
