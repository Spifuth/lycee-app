FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl libjpeg62-turbo zlib1g \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

COPY app ./app

# Note: runs as root inside the container so the SQLite bind-mount at /data
# is writable regardless of the host user that owns it. Container isolation
# is preserved via `no-new-privileges` and the dedicated internal network.
RUN mkdir -p /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

# --proxy-headers + --forwarded-allow-ips: derrière nginx (lycee-web). Sans ça,
# uvicorn ignore X-Forwarded-For et request.client.host = l'IP du conteneur nginx
# pour TOUS les clients → la limite slowapi par-IP devient un seul compteur global
# (5 inscriptions/h pour l'app entière). On fait confiance au XFF posé par nginx.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
