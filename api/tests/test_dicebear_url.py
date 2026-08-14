"""The DiceBear avatar URL carries an API-version segment, and it is a contract
with whatever `dicebear/api` image is deployed.

This exists because that segment was hardcoded as "9.x" while the deployed image
was bumped from dicebear/api:2 to :4.11 on 2026-08-14. v4 serves /10.x/ and
returns 404 for /9.x/, so the hardcoded value would have 404'd every generated
avatar on a live site — with nothing in the test suite noticing.

The version therefore lives in settings, and these tests assert it is actually
read from there rather than baked into the f-string again.
"""

from app.config import settings
from app.routers import profile_router


class _User:
    """Minimal stand-in: _to_out only touches these fields on the DiceBear path."""

    def __init__(self, seed="seed-123"):
        self.avatar_seed = seed
        self.custom_avatar_status = None
        self.custom_avatar_filename = None


def test_settings_expose_a_dicebear_api_version():
    assert getattr(settings, "dicebear_api_version", None), (
        "dicebear_api_version must be configurable — it is a contract with the "
        "deployed dicebear/api image, not a constant"
    )


def test_configured_version_appears_in_the_generated_url():
    url = profile_router._dicebear_avatar_url(_User())
    assert f"/{settings.dicebear_api_version}/" in url
    assert settings.dicebear_style in url
    assert "seed=seed-123" in url


def test_url_does_not_hardcode_a_stale_major():
    """Guards the specific regression: a literal 9.x surviving a config change."""
    settings_version = settings.dicebear_api_version
    url = profile_router._dicebear_avatar_url(_User())
    stale = [v for v in ("9.x", "8.x", "7.x") if v != settings_version and f"/{v}/" in url]
    assert not stale, f"URL contains a hardcoded stale API version: {stale}"


def test_approved_custom_avatar_bypasses_dicebear_entirely():
    u = _User()
    u.custom_avatar_status = "approved"
    u.custom_avatar_filename = "abc.png"
    url = profile_router._dicebear_avatar_url(u)
    assert url is None, "an approved custom avatar must not route through DiceBear"
