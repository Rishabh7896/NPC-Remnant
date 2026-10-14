import json
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import SessionRow, EvidenceRow
from app.services.memory_service import add_claim

INITIAL_GAME={"engineering_wing":"unknown","reactor":"unstable","sensor":"uninspected","sensor_repaired":False}
INITIAL_MISSION={"id":"restore_station","status":"active","step":"investigate_engineering_wing"}

def get_session(db:Session, session_id:str): return db.get(SessionRow,session_id)
def state(row): return {"engineering_wing":json.loads(row.game_state_json),"mission":json.loads(row.mission_state_json)}
def update_state(row, game, mission=None):
    row.game_state_json=json.dumps(game)
    if mission is not None: row.mission_state_json=json.dumps(mission)

def collect_evidence(db:Session,row:SessionRow,evidence_id:str):
    game=json.loads(row.game_state_json); mission=json.loads(row.mission_state_json)
    if evidence_id=="sensor_engineering_01":
        if game["sensor"]!="uninspected":
            return {"accepted":False,"message":"Sensor has already been inspected.","game_state":game}
        ev=db.get(EvidenceRow,evidence_id)
        if not ev: return {"accepted":False,"message":"Unknown evidence item."}
        game["sensor"]="hazard_detected"; game["engineering_wing"]="conflicted"
        mem=add_claim(db,row.id,claim_key="engineering_wing_hazard",claim_text="Sensor reports a hazard in the engineering wing.",subject=ev.subject,predicate=ev.predicate,value=ev.value,source_type=ev.source_type,source_id=ev.id,confidence=.95,authoritative=True)
        mission["step"]="repair_sensor"
        update_state(row,game,mission); db.commit()
        return {"accepted":True,"message":"Sensor warning recorded; the earlier crew report is in conflict.","aria_message":"The sensor reports a hazard. That conflicts with the earlier crew report, so I recommend repairing or verifying the sensor before entry.","evidence":{"id":ev.id,"type":"sensor_reading","subject":ev.subject,"value":"hazard_detected","trust_level":ev.trust_level},"game_state":game}
    return {"accepted":False,"message":"Unknown evidence item."}

def perform_action(db:Session,row:SessionRow,action_type:str):
    game=json.loads(row.game_state_json); mission=json.loads(row.mission_state_json)
    if action_type=="inspect_sensor":
        return {"accepted":False,"action_type":action_type,"reason":"Use the sensor console in the 3D scene to collect the scripted reading.","game_state":game}
    if action_type=="repair_sensor":
        if game["sensor"]=="uninspected": return {"accepted":False,"action_type":action_type,"reason":"Inspect the sensor before attempting repair.","game_state":game}
        if game["sensor_repaired"]: return {"accepted":False,"action_type":action_type,"reason":"Sensor is already repaired.","game_state":game}
        game["sensor_repaired"]=True; game["sensor"]="repaired"; mission["step"]="verify_sensor"
        ev=db.get(EvidenceRow,"sensor_normal_after_repair")
        if ev:
            add_claim(db,row.id,claim_key="engineering_wing_safe_verified",claim_text="Post-repair sensor reading confirms the engineering wing is safe.",subject=ev.subject,predicate=ev.predicate,value=ev.value,source_type="sensor",source_id=ev.id,confidence=.99,authoritative=True)
        game["engineering_wing"]="safe"; mission["step"]="enter_engineering_wing"; mission["status"]="complete"
        update_state(row,game,mission); db.commit()
        return {"accepted":True,"action_type":action_type,"reason":"Sensor repaired. The authoritative post-repair reading confirms the wing is safe.","game_state":game,"mission":mission}
    if action_type=="inspect_engineering_wing":
        return {"accepted":False,"action_type":action_type,"reason":"Verify the sensor first; direct entry inspection is not available while the hazard is unresolved.","game_state":game}
    if action_type=="enter_engineering_wing":
        if game["engineering_wing"]!="safe": return {"accepted":False,"action_type":action_type,"reason":"Hazard status is unresolved; inspect and repair the sensor first.","game_state":game}
        mission["status"]="complete"; mission["step"]="mission_complete"; update_state(row,game,mission); db.commit()
        return {"accepted":True,"action_type":action_type,"reason":"Entry permitted: verified evidence confirms the wing is safe.","game_state":game,"mission":mission}
    return {"accepted":False,"action_type":action_type,"reason":"Action is not supported.","game_state":game}
