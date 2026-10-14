from pydantic import BaseModel, Field
from typing import Literal

class CreateSessionRequest(BaseModel):
    player_name: str = Field(default="Commander", max_length=80)
    scenario_id: str = Field(default="mars_station_01", max_length=100)

class DialogueRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    location: str = Field(default="control_room", max_length=80)

class EvidenceRequest(BaseModel):
    evidence_id: str = Field(min_length=1, max_length=100)

class ActionRequest(BaseModel):
    action_type: Literal["inspect_sensor", "repair_sensor", "inspect_engineering_wing", "enter_engineering_wing"]
