# PROJECT REMNANT — After Hours

Explore a lively 3D Indian food plaza at dusk. Wander between 18 family-run stalls—from pani puri, chaat, dosa, and idli to chai, jalebi, kulfi, and filter coffee—and talk with the people behind them.

Every player message and vendor reply is saved to the session. The LLM sees the conversation across all stalls, uses the player’s saved memories for context, writes each vendor’s reply in character, and extracts durable preferences the player shared. A conversation with the chai vendor can shape a later conversation at the dosa stall.

## Play

- The landing screen shows the plaza stats. Choose **Start Your Evening** to enter the full-window 3D plaza.
- Move around with **WASD** or the **arrow keys**. Drag to orbit the view and scroll to zoom. Click a stall, or tell your character where to go: “Take me to the masala dosa stall,” “Find something spicy,” or “Surprise me.”
- The Gemini game director interprets each message as a movement request, a vendor conversation, or plaza chat. Your character walks to a recognized destination; once there, continue speaking naturally with that shopkeeper.
- Each shopkeeper has their own conversation history. Details you share can be remembered across vendors.
- Type freely, or **hold Space to record** and release to send. The microphone button also works as press and hold.
- Vendor replies are spoken aloud by default. Use **Voice On/Off** or a speaker icon to control playback.
- The memory panel shows details vendors may use in later conversations.

Voice recognition uses the browser’s speech recognition support (Chrome and Edge work best); text-to-speech uses browser speech synthesis. Microphone access is requested by the browser on first use. Typed chat works in every browser.

## Run locally

Requirements: Node.js 20+ and Python 3.9+ (Python 3.11+ recommended).

### 1. Configure the LLM

Copy `backend/.env.example` to `backend/.env`, then set `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL`. Gemini is configured by default. OpenAI-compatible `/chat/completions` providers are also supported. The key stays on the backend and must never be added to the frontend.

The offline mode lets the plaza load without credentials, but vendor conversations will not be LLM-generated until a working key and model are configured.

### 2. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Health check: http://localhost:8000/health. API docs: http://localhost:8000/docs.

### 3. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually http://localhost:5173). Use the reset button in the top bar to start a fresh plaza visit.

## Demo conversation

1. Visit Rani’s pani puri stall and ask what makes her pani puri special.
2. Tell her a little about your spice tolerance, favorite snack, or who you’re exploring with.
3. Visit another stall and ask a question that builds on what you shared earlier.
4. Return to the landing screen and check the saved visit stats, then start again to continue.
5. Try voice input by holding Space, speaking naturally, and releasing. Listen to the vendor’s spoken reply.

## Project layout

- `frontend/src/scene/GameScene.tsx`: explorable 3D plaza, vendors, and keyboard movement.
- `backend/app/services/llm_service.py`: natural-language game direction and in-character conversation generation.
- `frontend/src/components/DialoguePanel.tsx`: freeform chat, hold-to-talk input, and spoken replies.
- `backend/app/stalls.py`: plaza and vendor character profiles.
- `backend/app/services/conversation.py`: persistent transcript and LLM-extracted memories.
- `backend/app/services/llm_service.py`: provider calls and in-character LLM responses.
- `backend/app/services/memory_service.py`: session memory storage and retrieval.

## Hackathon scope

The market is procedural and uses simple 3D geometry, so it runs without downloaded art assets. Vendor biographies and the menu are authored world data; conversations and memory extraction come from the configured LLM. The transcript and memories are stored in the local SQLite database for each session. This is a prototype rather than a production service.
