# API contract

Base path: `/api/v1`

- `GET /health` -> service status
- `GET /sessions/stalls` -> authored plaza menu and vendor context
- `POST /sessions` -> creates a persistent plaza session
- `GET /sessions/{id}` -> session, mission, and world state
- `GET /sessions/{id}/messages` -> complete saved conversation across vendors
- `POST /sessions/{id}/dialogue` body `{ "message": "...", "location": "evening_food_plaza", "npc_id": "pani-puri" }`
- `POST /sessions/{id}/interact` body with the same shape -> LLM resolves freeform input into navigation, a vendor conversation, or plaza chat. Navigation responses include `action.stall_id`.
- `GET /sessions/{id}/memories?limit=50` -> LLM-extracted personal memories and conflicts

For each interaction, the backend loads recent plaza history and saved memories, asks the configured LLM to interpret intent and resolve a stall, then either sets a movement destination or generates a character reply. Vendor turns receive the full persistent transcript plus the selected vendor profile; durable details extracted by the LLM become shared memories. The provider is called from the backend; its key is configured in `backend/.env`.
