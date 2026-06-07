from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .config import settings
from .db import init_db
from .limiter import limiter
from .routers import admin_router, ai_router, auth_router, bot_router, events_router, live_router, profile_router, questions_router, quiz_router, vote_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Lycée App API", version="0.1.0", lifespan=lifespan)

    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(status_code=429, content={"detail": f"Trop de requêtes ({exc.detail})."})

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router.router)
    app.include_router(profile_router.router)
    app.include_router(events_router.router)
    app.include_router(vote_router.router)
    app.include_router(questions_router.router)
    app.include_router(quiz_router.router)
    app.include_router(ai_router.router)
    app.include_router(live_router.router)
    app.include_router(bot_router.router)
    app.include_router(admin_router.router)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


app = create_app()
