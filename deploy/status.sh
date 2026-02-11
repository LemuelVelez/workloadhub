#!/usr/bin/env bash
set -euo pipefail

echo "=== Active upstream ==="
if [ -f /opt/workloadhub/caddy/upstream.caddy ]; then
  cat /opt/workloadhub/caddy/upstream.caddy
else
  echo "No upstream file yet."
fi

echo
echo "=== Containers ==="
docker ps --filter "name=workloadhub-" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"
