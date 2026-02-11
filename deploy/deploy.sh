#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=".env.production"
EDGE_COMPOSE="docker-compose.edge.yml"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
[ -f "$EDGE_COMPOSE" ] || { echo "Missing $EDGE_COMPOSE"; exit 1; }

mkdir -p /opt/workloadhub/caddy

docker network inspect wh_public >/dev/null 2>&1 || docker network create wh_public
docker network inspect wh_blue_net >/dev/null 2>&1 || docker network create --internal wh_blue_net
docker network inspect wh_green_net >/dev/null 2>&1 || docker network create --internal wh_green_net

if [ -f /opt/workloadhub/caddy/upstream.caddy ]; then
  if grep -q 'workloadhub-green:8080' /opt/workloadhub/caddy/upstream.caddy; then
    active="green"
  elif grep -q 'workloadhub-blue:8080' /opt/workloadhub/caddy/upstream.caddy; then
    active="blue"
  else
    active="unknown"
  fi
else
  active="none"
fi

if [ "$active" = "blue" ]; then
  target="green"
elif [ "$active" = "green" ]; then
  target="blue"
else
  target="blue"
fi

compose_file="docker-compose.${target}.yml"
container_name="workloadhub-${target}"
upstream_file="deploy/caddy/upstream-${target}.caddy"

tag="$(date +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo local)"
log "Active=${active} | Target=${target} | ImageTag=${tag}"

APP_IMAGE_TAG="$tag" docker compose -p workloadhub-app --env-file "$ENV_FILE" -f "$compose_file" build app
APP_IMAGE_TAG="$tag" docker compose -p workloadhub-app --env-file "$ENV_FILE" -f "$compose_file" up -d app

log "Waiting for ${container_name} health..."
for i in $(seq 1 60); do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' "$container_name" 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    log "${container_name} is healthy"
    break
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "${container_name} is unhealthy"
    docker logs --tail 120 "$container_name" || true
    exit 1
  fi
  if [ "$i" -eq 60 ]; then
    echo "Timed out waiting for health"
    docker logs --tail 120 "$container_name" || true
    exit 1
  fi
  sleep 2
done

cp "$upstream_file" /opt/workloadhub/caddy/upstream.caddy

if docker ps --format '{{.Names}}' | grep -qx 'workloadhub-edge'; then
  docker exec workloadhub-edge caddy reload --config /etc/caddy/Caddyfile
else
  docker compose -p workloadhub-edge -f "$EDGE_COMPOSE" up -d edge
fi

log "Switched traffic to ${target}"
if [ "$active" = "blue" ] || [ "$active" = "green" ]; then
  log "Previous ${active} stays running for rollback safety"
fi

log "Done. Check:"
log "curl -I https://workloadhub.jrmsu-tc.cloud"
