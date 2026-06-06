# lycee-app — backend (`api/`)

FastAPI backend for the lycée STI2D SIN site. See the root README for project overview and local setup.

## Migrations (Alembic)

Schema is managed by Alembic; the container entrypoint runs `alembic upgrade head` on boot.

### Existing deployments — one-time baseline stamp
The production DB already contains every column (previously managed by ad-hoc
migrations). Before the first deploy of the Alembic change, stamp the baseline so
Alembic records it as applied without trying to re-create tables:

    docker compose exec lycee-api alembic stamp head

New/empty databases need no stamp — `upgrade head` creates everything.
