"""Proxy Ollama avec streaming SSE.

Sécurité :
- auth requise (sinon n'importe qui peut consommer ton GPU/CPU)
- rate-limit par user (3/min par défaut, configurable via settings)
- prompt length capped
- timeout strict
- pas d'exfiltration des params côté frontend (le modèle est défini côté serveur)
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from sqlalchemy.orm import Session

from .. import auth, state
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import User

router = APIRouter(prefix="/api/ai", tags=["ai"])
log = logging.getLogger(__name__)

PROMPT_MAX_LEN = 500

PRESETS: dict[str, str] = {
    "resume":   "Résume ce texte en 3 phrases maximum, en français :\n\n{user}",
    "traduis":  "Traduis ce texte en anglais :\n\n{user}",
    "explique": "Explique-moi le sujet suivant comme à un enfant de 10 ans, en français, en 4-5 phrases :\n\n{user}",
    "poeme":    "Écris un poème de 4 lignes en français sur :\n\n{user}",
}


class ChatIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=PROMPT_MAX_LEN)
    preset: str | None = None


class InfoOut(BaseModel):
    model: str
    server: str
    presets: list[str]
    rate_limit_per_min: int
    prompt_max_len: int
    available: bool   # techniquement up (URL configurée et joignable)
    enabled: bool     # toggle admin — verrouillé tant que l'intervenant n'a pas ouvert


@router.get("/info", response_model=InfoOut)
def info(db: Session = Depends(get_db)):
    """Métadonnées du module IA — utilisées par l'UI pour afficher le modèle + l'état."""
    return InfoOut(
        model=settings.ollama_model,
        server="ton homelab perso (pas chez OpenAI/Google)",
        presets=list(PRESETS.keys()),
        rate_limit_per_min=settings.ollama_rate_limit_per_min,
        prompt_max_len=PROMPT_MAX_LEN,
        available=bool(settings.ollama_url),
        enabled=state.is_ai_open(db),
    )


async def _stream_ollama(prompt: str) -> AsyncIterator[bytes]:
    """Convertit la sortie line-by-line JSON d'Ollama en SSE."""
    url = settings.ollama_url.rstrip("/") + "/api/generate"
    payload = {
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": 0.7,
            "num_predict": 400,
        },
    }
    timeout = httpx.Timeout(settings.ollama_timeout_s, connect=5.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", url, json=payload) as r:
                if r.status_code >= 400:
                    body = (await r.aread()).decode("utf-8", "replace")
                    yield _sse({"type": "error", "detail": f"Ollama {r.status_code}: {body[:200]}"})
                    return
                async for line in r.aiter_lines():
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    token = chunk.get("response", "")
                    if token:
                        yield _sse({"type": "token", "text": token})
                    if chunk.get("done"):
                        yield _sse({
                            "type": "done",
                            "eval_count": chunk.get("eval_count"),
                            "eval_duration_ns": chunk.get("eval_duration"),
                            "total_duration_ns": chunk.get("total_duration"),
                        })
                        return
    except httpx.ReadTimeout:
        yield _sse({"type": "error", "detail": "Timeout — l'IA met trop de temps à répondre."})
    except httpx.ConnectError as e:
        log.warning("ollama connect error: %s", e)
        yield _sse({"type": "error", "detail": "Ollama injoignable depuis le container."})
    except Exception as e:
        log.exception("ollama stream failure")
        yield _sse({"type": "error", "detail": f"Erreur inattendue: {type(e).__name__}"})


def _sse(payload: dict) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")


@router.post("/chat")
@limiter.limit(f"{settings.ollama_rate_limit_per_min}/minute")
async def chat(
    request: Request,
    payload: ChatIn,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not settings.ollama_url:
        raise HTTPException(503, "Le module IA est désactivé (LYCEE_OLLAMA_URL non configuré).")
    if not state.is_ai_open(db):
        raise HTTPException(423, "Le module IA est verrouillé par l'intervenant.")

    user_prompt = payload.prompt.strip()
    if not user_prompt:
        raise HTTPException(400, "Prompt vide.")
    if auth.contains_banned(user_prompt):
        raise HTTPException(400, "Prompt refusé par le filtre.")

    if payload.preset and payload.preset in PRESETS:
        full_prompt = PRESETS[payload.preset].format(user=user_prompt)
    else:
        full_prompt = user_prompt

    return StreamingResponse(
        _stream_ollama(full_prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
            "Connection": "keep-alive",
        },
    )
