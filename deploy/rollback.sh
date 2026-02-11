#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

target="${1:-}"
if [[ ! "$target" =~ ^(blue|green)$ ]]; then
  echo "Usage: ./deploy/rollback.sh blue|green"
  exit 1
fi

cp "deploy/caddy/upstream-${target}.caddy" /opt/workloadhub/caddy/upstream.caddy
docker exec workloadhub-edge caddy reload --config /etc/caddy/Caddyfile
echo "Rolled back traffic to ${target}"
