from app.database import Base, engine, SessionLocal
from app.models import SessionRow
from app.services.memory_service import add_claim, get_memories, get_conflicts
import json, uuid

def test_conflicting_claims_are_preserved():
    Base.metadata.create_all(engine)
    db=SessionLocal()
    try:
        sid=str(uuid.uuid4()); db.add(SessionRow(id=sid,player_name="Test",scenario_id="test",game_state_json=json.dumps({}),mission_state_json=json.dumps({}))); db.commit()
        add_claim(db,sid,claim_key="safe",claim_text="Player says safe",subject="wing",predicate="is_safe",value="true",source_type="player_report")
        add_claim(db,sid,claim_key="hazard",claim_text="Sensor says hazard",subject="wing",predicate="is_safe",value="false",source_type="sensor",source_id="sensor-test",authoritative=True)
        db.commit()
        assert len(get_memories(db,sid)) == 2
        assert len(get_conflicts(db,sid)) >= 1
    finally: db.close()
