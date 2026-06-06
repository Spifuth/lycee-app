from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from .. import auth, badges
from ..config import settings
from ..db import get_db
from ..limiter import limiter
from ..models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

COOKIE_NAME = "session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 30


class SignupIn(BaseModel):
    pseudo: str = Field(min_length=3, max_length=20)
    bio: str | None = Field(default=None, max_length=200)


class SignupOut(BaseModel):
    pseudo: str
    passphrase: str
    avatar_seed: str
    qr_data_url: str
    qr_login_url: str
    discord_invite_url: str | None = None


class LoginIn(BaseModel):
    pseudo: str
    passphrase: str


class LoginQRIn(BaseModel):
    qr_token: str


class TokenOut(BaseModel):
    pseudo: str
    token: str


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=settings.app_env != "dev",
    )


@router.post("/signup", response_model=SignupOut)
@limiter.limit(f"{settings.rate_limit_signup_per_hour}/hour")
def signup(request: Request, payload: SignupIn, response: Response, db: Session = Depends(get_db)):
    pseudo = auth.validate_pseudo(payload.pseudo)
    if db.get(User, pseudo) is not None:
        raise HTTPException(409, "Ce pseudo est déjà pris.")

    bio = (payload.bio or "").strip()
    if bio and auth.contains_banned(bio):
        raise HTTPException(400, "Bio refusée par le filtre.")

    passphrase = auth.generate_passphrase()
    avatar_seed = auth.generate_avatar_seed()
    user = User(
        pseudo=pseudo,
        password_hash=auth.hash_password(passphrase),
        avatar_seed=avatar_seed,
        bio=bio,
    )
    db.add(user)
    db.flush()
    badges.maybe_unlock_on_signup(db, user)
    db.commit()

    session_token = auth.create_jwt(pseudo, kind="session")
    qr_token = auth.create_jwt(pseudo, kind="qr")
    qr_login_url = f"{settings.public_base_url}/login?token={qr_token}"
    qr_data_url = auth.build_qr_data_url(qr_login_url)

    _set_session_cookie(response, session_token)

    return SignupOut(
        pseudo=pseudo,
        passphrase=passphrase,
        avatar_seed=avatar_seed,
        qr_data_url=qr_data_url,
        qr_login_url=qr_login_url,
        discord_invite_url=settings.discord_invite_url or None,
    )


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    pseudo = payload.pseudo.strip()
    user = db.get(User, pseudo)
    if user is None or user.banned or not auth.verify_password(payload.passphrase, user.password_hash):
        raise HTTPException(401, "Pseudo ou passphrase incorrect.")

    user.last_seen = datetime.now(timezone.utc)
    badges.maybe_unlock_on_login(db, user)
    db.commit()

    token = auth.create_jwt(pseudo, kind="session")
    _set_session_cookie(response, token)
    return TokenOut(pseudo=pseudo, token=token)


@router.post("/login-qr", response_model=TokenOut)
@limiter.limit("20/minute")
def login_qr(request: Request, payload: LoginQRIn, response: Response, db: Session = Depends(get_db)):
    data = auth.decode_jwt(payload.qr_token)
    if data.get("kind") != "qr":
        raise HTTPException(400, "Ce token n'est pas un token QR.")
    pseudo = data["sub"]
    user = db.get(User, pseudo)
    if user is None or user.banned:
        raise HTTPException(401, "Compte introuvable.")
    user.last_seen = datetime.now(timezone.utc)
    badges.maybe_unlock_on_login(db, user)
    db.commit()
    token = auth.create_jwt(pseudo, kind="session")
    _set_session_cookie(response, token)
    return TokenOut(pseudo=pseudo, token=token)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


# Avoid unused-import warning for slowapi key function
_ = get_remote_address
