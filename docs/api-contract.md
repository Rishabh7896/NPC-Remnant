# API contract
Base path: `/api/v1`

- `GET /health` -> `{ "status": "ok" }`
- `POST /sessions` body `{ "player_name": "Commander", "scenario_id": "mars_station_01" }`
- `GET /sessions/{id}` -> session, mission, and game state
- `POST /sessions/{id}/dialogue` body `{ "message": "...", "location": "control_room" }`
- `GET /sessions/{id}/memories?limit=50` -> memories and conflicts
- `POST /sessions/{id}/evidence` body `{ "evidence_id": "sensor_engineering_01" }`
- `POST /sessions/{id}/actions` body `{ "action_type": "repair_sensor" }`

Game state is authoritative on the backend. The browser must render returned state and must not locally authorize mission actions.
