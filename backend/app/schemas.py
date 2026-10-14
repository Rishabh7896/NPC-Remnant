from pydantic import BaseModel, Field

class CreateSessionRequest(BaseModel):
    player_name: str = Field(default="Visitor", max_length=80)
    scenario_id: str = Field(default="evening_food_plaza", max_length=100)

class DialogueRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    location: str = Field(default="food_plaza", max_length=80)
    npc_id: str = Field(default="", max_length=80)


class AddToCartRequest(BaseModel):
    vendor_id: str = Field(min_length=1, max_length=80)
    product_id: str = Field(min_length=1, max_length=80)
    quantity: int = Field(default=1, ge=1, le=10)
    variant_id: str = Field(default="")
    add_on_ids: list[str] = Field(default_factory=list)
    notes: str = Field(default="", max_length=200)

class ApplyDiscountRequest(BaseModel):
    vendor_id: str = Field(min_length=1, max_length=80)
    proposed_discount: int = Field(ge=0, le=500)
    reason: str = Field(default="friendly_bargaining", max_length=120)

class CheckoutRequest(BaseModel):
    idempotency_key: str = Field(default="", max_length=120)

