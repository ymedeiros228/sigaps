#!/usr/bin/env bash
# Sobe backend + frontend para testes Playwright (CI ou local).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
DATABASE_URL="${DATABASE_URL:-postgresql://sigaps:sigaps_secret@127.0.0.1:5432/sigaps?schema=public}"
JWT_SECRET="${JWT_SECRET:-sigaps-e2e-test-secret}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:${FRONTEND_PORT}}"

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

echo "==> Backend: install, migrate, seed, start"
cd "$ROOT/backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
export DATABASE_URL JWT_SECRET FRONTEND_URL NODE_ENV=production PORT="$BACKEND_PORT"
npm run build
npm run start:prod &
BACKEND_PID=$!

echo "==> Aguardando API em :${BACKEND_PORT}"
for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${BACKEND_PORT}/health" >/dev/null; then
    echo "API pronta."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Timeout aguardando backend" >&2
    exit 1
  fi
  sleep 2
done

echo "==> Frontend: build e preview"
cd "$ROOT/frontend"
npm ci
VITE_API_URL="http://127.0.0.1:${BACKEND_PORT}" VITE_DEV_AUTO_LOGIN=false npm run build
npm run preview -- --host 127.0.0.1 --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${FRONTEND_PORT}/" >/dev/null; then
    echo "Frontend pronto."
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "Timeout aguardando frontend" >&2
    exit 1
  fi
  sleep 1
done

echo "==> Playwright"
export PLAYWRIGHT_BASE_URL="http://127.0.0.1:${FRONTEND_PORT}"
npx playwright install chromium --with-deps
npm run test:e2e
