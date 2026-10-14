"""Authored gameplay rules. Language models may only propose these actions."""

QUESTS = {
    "rani_chai_favour": {
        "id": "rani_chai_favour",
        "giver_id": "pani-puri",
        "title": "A Ginger Chai for Rani",
        "summary": "Take Rani's tea request to Babu at the cutting chai stall.",
        "objective": {"type": "talk_to_vendor", "vendor_id": "chai"},
        "reward": {"trust": 0.12, "discovery": "Rani shares her off-menu sweet-tamarind pani recipe."},
    },
}

QUESTS_BY_GIVER = {}
for quest in QUESTS.values():
    QUESTS_BY_GIVER.setdefault(quest["giver_id"], []).append(quest)
