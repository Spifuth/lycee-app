from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import auth, avatars as avatars_mod, badges
from ..config import settings
from ..db import get_db
from ..models import Event, User

router = APIRouter(prefix="/api/profile", tags=["profile"])


def approved_avatar_path(db: Session, filename: str) -> Path | None:
    """Return the on-disk Path for *filename* only when BOTH conditions hold:

    1. The file exists on disk (and passes the traversal guard in ``path_for``).
    2. A User row exists with ``custom_avatar_filename == filename`` and
       ``custom_avatar_status == "approved"``.

    Returns ``None`` in every other case (missing file, pending/null status,
    no matching user row, traversal attempt).  Suitable for direct unit testing
    against a ``db`` fixture without an HTTP layer.
    """
    path = avatars_mod.path_for(filename)
    if path is None:
        return None
    user = db.scalar(
        select(User).where(
            User.custom_avatar_filename == filename,
            User.custom_avatar_status == "approved",
        )
    )
    if user is None:
        return None
    return path


class BadgeOut(BaseModel):
    id: str
    label: str
    emoji: str
    description: str
    unlocked: bool
    unlocked_at: str | None = None


class ProfileOut(BaseModel):
    pseudo: str
    avatar_seed: str
    avatar_url: str
    bio: str
    created_at: datetime
    last_seen: datetime
    badges: list[BadgeOut]
    discord_invite_url: str | None = None
    custom_avatar_status: str | None = None   # null | "pending" | "approved"


class ProfilePatch(BaseModel):
    bio: str | None = Field(default=None, max_length=200)
    avatar_seed: str | None = Field(default=None, min_length=1, max_length=32)


def _to_out(db: Session, user: User) -> ProfileOut:
    # Avatar custom approuvé → on l'utilise. Sinon (pas d'upload ou pending) → DiceBear.
    if user.custom_avatar_status == "approved" and user.custom_avatar_filename:
        avatar_url = f"{settings.public_base_url}/api/profile/avatar/{user.custom_avatar_filename}"
    else:
        avatar_url = f"{settings.dicebear_url}/9.x/{settings.dicebear_style}/svg?seed={user.avatar_seed}"
    unlocked = {b["id"]: b for b in badges.list_unlocked(db, user.pseudo)}
    catalog = badges.catalog_for(db, user.pseudo)
    enriched = [
        BadgeOut(
            id=b["id"],
            label=b["label"],
            emoji=b["emoji"],
            description=b["description"],
            unlocked=b["unlocked"],
            unlocked_at=unlocked.get(b["id"], {}).get("unlocked_at"),
        )
        for b in catalog
    ]
    return ProfileOut(
        pseudo=user.pseudo,
        avatar_seed=user.avatar_seed,
        avatar_url=avatar_url,
        bio=user.bio,
        created_at=user.created_at,
        last_seen=user.last_seen,
        badges=enriched,
        discord_invite_url=settings.discord_invite_url or None,
        custom_avatar_status=user.custom_avatar_status,
    )


@router.get("/me", response_model=ProfileOut)
def get_me(user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return _to_out(db, user)


@router.patch("/me", response_model=ProfileOut)
def patch_me(
    patch: ProfilePatch,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    bio_changed = False
    avatar_changed = False

    if patch.bio is not None:
        bio = patch.bio.strip()
        if bio and auth.contains_banned(bio):
            raise HTTPException(400, "Bio refusée par le filtre.")
        if bio != user.bio:
            user.bio = bio
            bio_changed = True

    if patch.avatar_seed is not None:
        new_seed = patch.avatar_seed.strip()
        if new_seed != user.avatar_seed:
            user.avatar_seed = new_seed
            avatar_changed = True
            # Record an event so the "Coquet" badge can count avatar changes
            db.add(Event(pseudo=user.pseudo, type=badges.EV_AVATAR_CHANGED, payload={}))

    user.last_seen = datetime.now(timezone.utc)
    db.flush()
    badges.maybe_unlock_on_profile_edit(db, user, bio_changed=bio_changed, avatar_changed=avatar_changed)
    db.commit()
    db.refresh(user)
    return _to_out(db, user)


@router.delete("/me")
def delete_me(
    response: Response,
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    pseudo = user.pseudo
    # Cleanup l'avatar custom si présent (le user est supprimé via cascade)
    avatars_mod.delete_for(pseudo)
    db.delete(user)
    db.commit()
    response.delete_cookie("session")
    return {"ok": True, "deleted": pseudo}


@router.post("/me/avatar", response_model=ProfileOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Upload d'une photo de profil custom. Statut pending jusqu'à approbation admin."""
    data = await file.read()
    if len(data) > avatars_mod.MAX_BYTES:
        raise HTTPException(413, f"Image trop lourde (max {avatars_mod.MAX_BYTES // 1_048_576} Mo).")
    filename = avatars_mod.save_upload(user.pseudo, data)
    if filename is None:
        raise HTTPException(400, "Format non supporté ou image invalide. Accepté : JPG, PNG, WebP, max 4 Mo.")
    user.custom_avatar_filename = filename
    user.custom_avatar_status = "pending"
    db.commit()
    db.refresh(user)
    return _to_out(db, user)


@router.delete("/me/avatar", response_model=ProfileOut)
def delete_my_avatar(
    user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Supprime ta PP custom (au profit du DiceBear par défaut)."""
    avatars_mod.delete_for(user.pseudo)
    user.custom_avatar_filename = None
    user.custom_avatar_status = None
    db.commit()
    db.refresh(user)
    return _to_out(db, user)


@router.get("/avatar/{filename}")
def serve_avatar(filename: str, db: Session = Depends(get_db)):
    """Sert le fichier image. Public uniquement pour les avatars approuvés par un admin."""
    path = approved_avatar_path(db, filename)
    if path is None:
        raise HTTPException(404, "Avatar introuvable.")
    return FileResponse(
        path,
        media_type=f"image/{path.suffix.lstrip('.')}",
        headers={"Cache-Control": "public, max-age=86400"},
    )
