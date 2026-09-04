import base64
import io
import re
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
import qrcode
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

WORDLIST_PATH = Path(__file__).parent / "wordlists" / "eff_fr.txt"
_WORDLIST: list[str] | None = None

PSEUDO_PATTERN = re.compile(r"^[a-zA-Z0-9_-]{3,20}$")
BANNED_WORDS_PATH = Path(__file__).parent / "wordlists" / "banned_fr.txt"
_BANNED: set[str] | None = None

ph = PasswordHasher()


def _load_wordlist() -> list[str]:
    global _WORDLIST
    if _WORDLIST is None:
        if not WORDLIST_PATH.exists():
            raise RuntimeError(f"Wordlist not found: {WORDLIST_PATH}")
        words = [w.strip().lower() for w in WORDLIST_PATH.read_text(encoding="utf-8").splitlines()]
        _WORDLIST = [w for w in words if w]
    return _WORDLIST


def _load_banned() -> set[str]:
    global _BANNED
    if _BANNED is None:
        if BANNED_WORDS_PATH.exists():
            words = [w.strip().lower() for w in BANNED_WORDS_PATH.read_text(encoding="utf-8").splitlines()]
            _BANNED = {w for w in words if w and not w.startswith("#")}
        else:
            _BANNED = set()
    return _BANNED


def generate_passphrase(n_words: int = 4) -> str:
    words = _load_wordlist()
    rng = secrets.SystemRandom()
    return "-".join(rng.choice(words) for _ in range(n_words))


def hash_password(plain: str) -> str:
    return ph.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        ph.verify(hashed, plain)
        return True
    except VerifyMismatchError:
        return False


def validate_pseudo(pseudo: str) -> str:
    pseudo = pseudo.strip()
    if not PSEUDO_PATTERN.match(pseudo):
        raise HTTPException(400, "Pseudo invalide (3-20 caractères, lettres/chiffres/-/_).")
    if contains_banned(pseudo):
        raise HTTPException(400, "Ce pseudo n'est pas autorisé.")
    return pseudo


def contains_banned(text: str) -> bool:
    banned = _load_banned()
    if not banned:
        return False
    normalized = text.lower()
    return any(b in normalized for b in banned)


def generate_avatar_seed() -> str:
    return secrets.token_urlsafe(8)


def create_jwt(pseudo: str, kind: str = "session") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": pseudo,
        "kind": kind,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.jwt_ttl_days)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Token invalide: {exc}") from exc


def build_qr_data_url(payload: str) -> str:
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


basic = HTTPBasic(realm="lycee-admin")
ADMIN_USER = "admin"


def require_admin(creds: HTTPBasicCredentials = Depends(basic)) -> str:
    if not settings.admin_password_hash:
        raise HTTPException(503, "Admin non configuré (LYCEE_ADMIN_PASSWORD_HASH manquant).")
    if creds.username != ADMIN_USER or not verify_password(creds.password, settings.admin_password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants admin invalides.",
            headers={"WWW-Authenticate": "Basic realm=lycee-admin"},
        )
    return creds.username


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get("session")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(None, 1)[1]
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Non authentifié.")
    data = decode_jwt(token)
    if data.get("kind") != "session":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token invalide pour cette opération.")
    user = db.get(User, data["sub"])
    if user is None or user.banned:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Compte introuvable ou banni.")
    return user
