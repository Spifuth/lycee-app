"""Avatar upload : stockage + validation + serve.

Les avatars sont stockés dans `/data/avatars/{pseudo}.{ext}`. Statut tracké
sur User (`custom_avatar_status` = "pending" | "approved"). DiceBear reste
le fallback quand pas d'avatar custom approuvé.
"""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path

log = logging.getLogger(__name__)

AVATARS_DIR = Path("/data/avatars")
MAX_BYTES = 4_194_304  # 4 MB
ALLOWED_MIMES = {"image/jpeg", "image/png", "image/webp"}
EXT_BY_MIME = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

# Magic bytes for image type detection (more reliable than client-sent MIME)
MAGIC_BYTES = {
    b"\xff\xd8\xff": "jpg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"RIFF": "webp",  # WebP starts with RIFF...WEBP
}


def ensure_dir() -> None:
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)


def detect_ext(data: bytes) -> str | None:
    """Détecte l'extension à partir des magic bytes. Retourne None si non-reconnu."""
    for magic, ext in MAGIC_BYTES.items():
        if data.startswith(magic):
            if ext == "webp":
                # WebP nécessite RIFF + WEBP à l'offset 8
                if len(data) >= 12 and data[8:12] == b"WEBP":
                    return "webp"
                return None
            return ext
    return None


def sanitize_pseudo(pseudo: str) -> str:
    """Pseudo est déjà validé via PSEUDO_PATTERN mais on filtre par sécurité."""
    return re.sub(r"[^A-Za-z0-9_-]", "", pseudo)[:20]


def save_upload(pseudo: str, data: bytes) -> str | None:
    """Valide + sauvegarde un avatar. Retourne le nom de fichier relatif, ou None si KO."""
    if len(data) > MAX_BYTES or len(data) < 50:
        return None
    ext = detect_ext(data)
    if ext is None:
        return None
    ensure_dir()
    safe = sanitize_pseudo(pseudo)
    if not safe:
        return None
    # Cleanup d'éventuels uploads précédents (différentes extensions)
    for existing in AVATARS_DIR.glob(f"{safe}.*"):
        try:
            existing.unlink()
        except OSError:
            pass
    filename = f"{safe}.{ext}"
    path = AVATARS_DIR / filename
    path.write_bytes(data)
    return filename


def delete_for(pseudo: str) -> None:
    safe = sanitize_pseudo(pseudo)
    if not safe:
        return
    for existing in AVATARS_DIR.glob(f"{safe}.*"):
        try:
            existing.unlink()
        except OSError:
            pass


def path_for(filename: str) -> Path | None:
    """Retourne le path absolu pour un filename donné, ou None si invalide / absent.
    Garde-fou contre la traversal directory.
    """
    if not filename or "/" in filename or ".." in filename:
        return None
    p = AVATARS_DIR / filename
    if not p.exists() or not p.is_file():
        return None
    # Vérifie que le path résolu reste dans AVATARS_DIR (double sécurité)
    try:
        p_resolved = p.resolve()
        if not str(p_resolved).startswith(str(AVATARS_DIR.resolve())):
            return None
    except OSError:
        return None
    return p
