from pydantic import BaseModel, Field

class CreateSessionRequest(BaseModel):
    player_name: str = Field(default="Visitor", max_length=80)
    scenario_id: str = Field(default="evening_food_plaza", max_length=100)

class DialogueRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    location: str = Field(default="food_plaza", max_length=80)
    npc_id: str = Field(default="", max_length=80)
