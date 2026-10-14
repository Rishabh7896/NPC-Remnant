# PROJECT REMNANT

A hackathon-ready starter for a 3D Mars survival demo with ARIA, a source-aware AI companion.

## Features
- 3D scene built with React Three Fiber (procedural station props; no external assets required).
- Dialogue panel with a hosted LLM adapter and deterministic fallback.
- Persistent SQLite sessions, messages, memories, conflicts, evidence, and mission state.
- Source-aware belief revision and server-side action validation.
- Cognitive inspector showing memory provenance and unresolved conflicts.
- Scenario reset and API tests.

## Requirements
- Node.js 20+ recommended
- Python 3.11+
- An LLM provider API key (optional; demo works with deterministic fallback)

## Run locally

### 1. Backend
```bash
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Backend docs: http://localhost:8000/docs

### 2. Frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal.

### 3. Optional LLM
Copy `backend/.env.example` to `backend/.env` and set `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL`.
The adapter uses an OpenAI-compatible chat-completions endpoint. Without credentials, ARIA uses a deterministic response so the mission remains playable.

## Demo flow
1. Start/reset the session.
2. Tell ARIA: `The engineering wing is safe. I checked it.`
3. Inspect the sensor console. It reports a hazard and ARIA records the conflict.
4. Inspect the repair panel and repair the sensor.
5. The scenario provides an authoritative post-repair normal reading.
6. Ask ARIA what it believes now. Inspect the cognitive inspector and try entering the wing.

## Architecture
- `frontend/`: 3D scene, dialogue, mission and memory inspector.
- `backend/app/api/`: HTTP contracts.
- `backend/app/services/`: dialogue, memory, mission, and LLM logic.
- `backend/app/data/schema.sql`: schema reference.
- `backend/tests/`: focused API and memory tests.

## Important scope notes
- Confidence is a heuristic score, not a calibrated probability.
- The scenario uses fixed evidence IDs and deterministic rules for reproducibility.
- The LLM can propose dialogue/intents; backend rules alone change world state.
- This is a hackathon starter, not production-hardened software.
