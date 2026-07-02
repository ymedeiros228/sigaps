#!/bin/sh
# POSIX sh (roda em Alpine/busybox, sem bash)
set -e

cd "$(dirname "$0")/.."

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL ausente — pulando migrate deploy"
  exit 0
fi

LOG=/tmp/prisma-migrate.log
attempt=0
max_repairs=8

while [ "$attempt" -le "$max_repairs" ]; do
  echo "Prisma migrate deploy (tentativa $((attempt + 1)))..."
  if npx prisma migrate deploy >"$LOG" 2>&1; then
    cat "$LOG"
    exit 0
  fi
  cat "$LOG"

  if ! grep -q P3009 "$LOG"; then
    exit 1
  fi

  FAILED=$(sed -n 's/.*`\([^`]*\)` migration started.*/\1/p' "$LOG" | head -1)
  if [ -z "$FAILED" ] || [ ! -f "prisma/migrations/${FAILED}/migration.sql" ]; then
    echo "Nao foi possivel identificar migracao falha para reparo automatico." >&2
    exit 1
  fi

  echo "Reparando migracao falha: $FAILED"
  npx prisma db execute --file "prisma/migrations/${FAILED}/migration.sql" --schema prisma/schema.prisma
  npx prisma migrate resolve --applied "$FAILED"
  attempt=$((attempt + 1))
done

echo "Excedeu tentativas de reparo de migracao." >&2
exit 1
