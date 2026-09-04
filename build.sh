#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

WEB_TAG="${WEB_TAG:-lycee-web:latest}"
API_TAG="${API_TAG:-lycee-api:latest}"
# Le front Next.js tourne en parallèle du front Astro jusqu'au sous-projet D.
WEB_NEXT_TAG="${WEB_NEXT_TAG:-lycee-web-next:latest}"

echo "==> building $API_TAG"
docker build --pull -t "$API_TAG" ./api

echo "==> building $WEB_TAG"
docker build --pull -t "$WEB_TAG" ./web

echo "==> building $WEB_NEXT_TAG"
docker build --pull -t "$WEB_NEXT_TAG" ./web-next

echo
echo "Done. Images:"
docker images --filter=reference="$API_TAG" --filter=reference="$WEB_TAG" --filter=reference="$WEB_NEXT_TAG" --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'
