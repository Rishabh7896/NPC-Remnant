from fastapi import FastAPI
from app.services.llm_service import provider_health
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app import models
from app.api import sessions, dialogue, memories

Base.metadata.create_all(bind=engine)
app=FastAPI(title="PROJECT REMNANT API",version="0.1.0",description="Source-aware cognitive NPC demo backend")
origins=[settings.frontend_origin,"http://localhost:5173","http://127.0.0.1:5173"]
app.add_middleware(CORSMiddleware,allow_origins=list(set(origins)),allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
app.include_router(sessions.router);app.include_router(dialogue.router);app.include_router(memories.router)
@app.get("/health")
async def health():
    provider = await provider_health()
    return {"status":"ok","service":"project-remnant-api","provider":provider}
