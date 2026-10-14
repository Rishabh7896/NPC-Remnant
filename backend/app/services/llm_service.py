import httpx
from app.config import settings

async def generate_reply(message: str, memories: list[dict], game_state: dict, recent_messages: list[dict]) -> str:
    # Safe fallback keeps the scenario playable without provider credentials.
    if not (settings.llm_api_key and settings.llm_model):
        low=message.lower()
        if "believe" in low or "why" in low:
            if any(m.get("subject")=="engineering_wing" and m.get("status")=="conflicted" for m in memories):
                return "My earlier record was a crew report, not verified fact. The sensor then reported a hazard, so I treated the claims as conflicting. After the sensor repair, the authoritative follow-up reading cleared the wing. I changed my recommendation because the evidence changed."
            return "I distinguish reports from verified station evidence. I currently need a sensor reading before I can safely recommend entry to the engineering wing."
        if "safe" in low and ("wing" in low or "engineering" in low):
            return "I'll record that as your report, Commander, but I won't treat it as verified until the station evidence supports it."
        if "evidence" in low:
            return "A reliable sensor reading, followed by a verified repair or clearance, would change my recommendation. I will keep the source attached to that evidence."
        return "Understood, Commander. I'll keep your report separate from verified station facts and check it against the mission evidence before recommending an action."
    system = ("You are ARIA, a concise AI crew companion in a Mars station. Never claim a fact is verified unless the supplied game state or memories show it. "
              "Distinguish player reports from sensor evidence. Do not claim to change game state. Explain uncertainty naturally. Keep replies under 90 words.\n"
              f"GAME STATE: {game_state}\nMEMORIES: {memories[-12:]}\nRECENT MESSAGES: {recent_messages[-10:]}")
    url=settings.llm_base_url.rstrip("/")+"/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=18) as client:
            resp=await client.post(url,headers={"Authorization":f"Bearer {settings.llm_api_key}"},json={"model":settings.llm_model,"messages":[{"role":"system","content":system},{"role":"user","content":message}],"temperature":0.4})
            resp.raise_for_status(); data=resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception:
        return "Comms are degraded. I will not change station state without verified data. Please retry, Commander."
