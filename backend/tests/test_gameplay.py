from app.services.gameplay_service import apply_action, progress_quests_for_visit
from app.services.run_service import initial_run


def test_unknown_model_action_cannot_change_state():
    game = initial_run()
    updated, events = apply_action(game, "pani-puri", {"type": "drop_database", "target": "everything"})
    assert updated == game
    assert events == []


def test_authored_quest_completes_once_and_updates_relationship():
    game = initial_run()
    game, events = apply_action(game, "pani-puri", {"type": "offer_quest", "quest_id": "rani_chai_favour"})
    assert events[0]["type"] == "quest_offered"
    game, events = apply_action(game, "pani-puri", {"type": "accept_quest", "quest_id": "rani_chai_favour"})
    assert events[0]["type"] == "quest_accepted"
    game, events = progress_quests_for_visit(game, "chai")
    assert events[0]["type"] == "quest_completed"
    assert game["quests"]["rani_chai_favour"]["status"] == "completed"
    assert game["relationships"]["pani-puri"]["trust"] == 0.12
    game, events = progress_quests_for_visit(game, "chai")
    assert events == []
