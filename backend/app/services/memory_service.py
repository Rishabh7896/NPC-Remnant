from typing import Optional
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import MemoryRow, ConflictRow

VALID_SOURCES = {"player_report", "sensor", "direct_observation", "mission_script"}

def memory_dict(m):
    return {"id":m.id,"claim_key":m.claim_key,"claim_text":m.claim_text,"subject":m.subject,"predicate":m.predicate,"value":m.value,"source_type":m.source_type,"source_id":m.source_id,"confidence":m.confidence,"status":m.status,"created_at":m.created_at.isoformat() if m.created_at else None}

def add_claim(db: Session, session_id: str, *, claim_key: str, claim_text: str, subject: str, predicate: str, value: str, source_type: str, source_id: Optional[str]=None, confidence: float=0.55, authoritative: bool=False):
    if source_type not in VALID_SOURCES: source_type = "player_report"
    new = MemoryRow(id=str(uuid4()), session_id=session_id, claim_key=claim_key, claim_text=claim_text, subject=subject, predicate=predicate, value=value, source_type=source_type, source_id=source_id, confidence=max(0.0,min(1.0,confidence)), status="verified" if authoritative else ("unverified" if source_type=="player_report" else "supported"))
    related = db.scalars(select(MemoryRow).where(MemoryRow.session_id==session_id, MemoryRow.subject==subject, MemoryRow.predicate==predicate)).all()
    db.add(new); db.flush()
    for old in related:
        if old.value == value or old.status == "superseded": continue
        old.status = "conflicted"
        if not authoritative: new.status = "conflicted"
        conflict = ConflictRow(id=str(uuid4()), session_id=session_id, memory_a_id=old.id, memory_b_id=new.id, status="unresolved")
        db.add(conflict)
    if authoritative:
        # Authoritative scenario evidence resolves only conflicts about this same proposition.
        conflicts = db.scalars(select(ConflictRow).where(ConflictRow.session_id==session_id, ConflictRow.status=="unresolved")).all()
        for c in conflicts:
            if c.memory_a_id == new.id or c.memory_b_id == new.id:
                c.status="resolved"; c.resolution_note=f"Resolved by authoritative evidence {source_id or new.id}."
            else:
                a=db.get(MemoryRow,c.memory_a_id); b=db.get(MemoryRow,c.memory_b_id)
                if a and b and a.subject==subject and a.predicate==predicate:
                    c.status="resolved"; c.resolution_note=f"Resolved by authoritative evidence {source_id or new.id}."
                    for old in (a,b):
                        if old.id != new.id and old.value != value: old.status="superseded"
    db.flush()
    return new

def get_memories(db: Session, session_id: str, limit: int=50):
    return db.scalars(select(MemoryRow).where(MemoryRow.session_id==session_id).order_by(MemoryRow.created_at.desc()).limit(limit)).all()

def get_relevant_memories(db: Session, session_id: str, query: str, vendor_id: str = "", limit: int = 12):
    """Return a small, relevant memory set instead of the entire player history."""
    terms = {word.casefold() for word in query.split() if len(word) > 3}
    if vendor_id:
        terms.add(vendor_id.replace("-", " ").casefold())
    candidates = get_memories(db, session_id, limit=120)
    scored = []
    for memory in candidates:
        haystack = f"{memory.claim_text} {memory.value} {memory.subject} {memory.predicate}".casefold()
        score = sum(term in haystack for term in terms)
        if score or memory.predicate.startswith("personal_context_"):
            scored.append((score, memory))
    scored.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)
    return [memory for _, memory in scored[:limit]]

def get_conflicts(db: Session, session_id: str):
    return db.scalars(select(ConflictRow).where(ConflictRow.session_id==session_id).order_by(ConflictRow.created_at.desc())).all()
