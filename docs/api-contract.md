# API contract

Base path: `/api/v1`

- `GET /health` -> service status
- `GET /sessions/stalls` -> authored plaza menu and vendor context
- `POST /sessions` -> creates a persistent plaza session
- `GET /sessions/{id}` -> session, mission, and world state
- `GET /sessions/{id}/messages` -> complete saved conversation across vendors
- `POST /sessions/{id}/dialogue` body `{ "message": "...", "location": "evening_food_plaza", "npc_id": "pani-puri" }`
- `GET /sessions/{id}/memories?limit=50` -> LLM-extracted personal memories and conflicts

For each dialogue turn, the backend loads the session transcript and saved memories, passes them with the selected vendor profile to the configured LLM, stores the player and vendor messages, and persists newly extracted memories. The provider is called from the backend; its key is configured in `backend/.env`.
