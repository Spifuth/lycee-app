"""
Smoke test: verifies the app uses the modern lifespan handler
instead of the deprecated @app.on_event("startup") decorator.

After migration:
- app.router.on_startup must be empty (no legacy event handlers)
- app.router.lifespan_context must be set (lifespan= was passed)
"""
from fastapi import FastAPI
from starlette.routing import _DefaultLifespan

from app.main import create_app


def test_create_app_succeeds():
    app = create_app()
    assert isinstance(app, FastAPI)


def test_no_on_event_startup_handlers():
    """Legacy @app.on_event('startup') appends to app.router.on_startup.
    After migrating to lifespan=, that list must be empty."""
    app = create_app()
    assert app.router.on_startup == [], (
        "on_startup is not empty — deprecated @app.on_event('startup') is still registered"
    )


def test_lifespan_context_is_not_default():
    """A custom lifespan= must replace Starlette's _DefaultLifespan sentinel.

    Asserting it's not the sentinel (rather than just `is not None`) is required:
    when lifespan= is omitted, Starlette sets lifespan_context to a truthy
    _DefaultLifespan instance, so a `is not None` check would pass even after
    reverting the migration. This assertion genuinely fails on reversion.
    """
    app = create_app()
    assert not isinstance(app.router.lifespan_context, _DefaultLifespan), (
        "lifespan_context is the default sentinel — lifespan= was not passed to FastAPI()"
    )
