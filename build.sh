#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

WEB_TAG="${WEB_TAG:-lycee-web:latest}"
API_TAG="${API_TAG:-lycee-api:latest}"

echo "==> building $API_TAG"
docker build -t "$API_TAG" ./api

echo "==> building $WEB_TAG"
docker build -t "$WEB_TAG" ./web

echo
echo "Done. Images:"
docker images --filter=reference="$API_TAG" --filter=reference="$WEB_TAG" --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}'
