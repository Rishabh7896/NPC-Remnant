"""Initial persistent state for the city roaming session."""


def initial_run():
    return {
        "game": "after_hours_city",
        "place": "Old Town Square",
        "visited": [],
        "status": "roaming",
        "last_event": "The evening lights are coming on. Pick a direction and meet the people around you.",
    }
