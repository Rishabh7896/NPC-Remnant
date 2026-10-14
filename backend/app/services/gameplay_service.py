"""Validated gameplay actions proposed during dialogue."""
from copy import deepcopy
from app.quests import QUESTS, QUESTS_BY_GIVER

VALID_ACTIONS = {"none", "offer_quest", "accept_quest", "recommend_dish", "record_discovery"}


def relationship_for(game: dict, vendor_id: str) -> dict:
    relationships = game.setdefault("relationships", {})
    return relationships.setdefault(vendor_id, {"trust": 0.0, "familiarity": 0, "milestones": []})


def eligible_quests(game: dict, vendor_id: str) -> list[dict]:
    states = game.setdefault("quests", {})
    return [quest for quest in QUESTS_BY_GIVER.get(vendor_id, []) if states.get(quest["id"], {}).get("status") not in {"completed", "active"}]


def apply_action(game: dict, vendor_id: str, proposal: object) -> tuple[dict, list[dict]]:
    """Apply only allowlisted actions with authored IDs and prerequisites."""
    state = deepcopy(game)
    if not isinstance(proposal, dict) or proposal.get("type") not in VALID_ACTIONS:
        return state, []
    action_type = proposal.get("type")
    events: list[dict] = []
    if action_type == "offer_quest":
        quest_id = str(proposal.get("quest_id") or "")
        quest = QUESTS.get(quest_id)
        if quest and quest["giver_id"] == vendor_id and quest in eligible_quests(state, vendor_id):
            state["quests"][quest_id] = {"status": "offered", "giver_id": vendor_id, "title": quest["title"]}
            events.append({"type": "quest_offered", "quest_id": quest_id, "title": quest["title"]})
    elif action_type == "accept_quest":
        quest_id = str(proposal.get("quest_id") or "")
        quest = QUESTS.get(quest_id)
        if quest and quest["giver_id"] == vendor_id and state["quests"].get(quest_id, {}).get("status") == "offered":
            state["quests"][quest_id]["status"] = "active"
            events.append({"type": "quest_accepted", "quest_id": quest_id, "title": quest["title"]})
    elif action_type == "recommend_dish":
        dish = str(proposal.get("dish") or "").strip()[:80]
        if dish:
            events.append({"type": "recommendation", "vendor_id": vendor_id, "dish": dish})
    elif action_type == "record_discovery":
        discovery = str(proposal.get("discovery") or "").strip()[:160]
        if discovery and discovery not in state.setdefault("discoveries", []):
            state["discoveries"].append(discovery)
            events.append({"type": "discovery", "text": discovery})
    return state, events


def progress_quests_for_visit(game: dict, vendor_id: str) -> tuple[dict, list[dict]]:
    """Quest completion comes from objective rules, never from model text alone."""
    state = deepcopy(game)
    events: list[dict] = []
    for quest_id, progress in state.setdefault("quests", {}).items():
        quest = QUESTS.get(quest_id)
        if not quest or progress.get("status") != "active":
            continue
        if quest["objective"] == {"type": "talk_to_vendor", "vendor_id": vendor_id}:
            progress["status"] = "completed"
            giver = relationship_for(state, quest["giver_id"])
            giver["trust"] = min(1.0, round(giver["trust"] + quest["reward"]["trust"], 2))
            giver["familiarity"] += 1
            milestone = f"Completed {quest['title']}"
            if milestone not in giver["milestones"]:
                giver["milestones"].append(milestone)
            discovery = quest["reward"]["discovery"]
            if discovery not in state.setdefault("discoveries", []):
                state["discoveries"].append(discovery)
            events.append({"type": "quest_completed", "quest_id": quest_id, "title": quest["title"], "reward": quest["reward"]})
    return state, events
