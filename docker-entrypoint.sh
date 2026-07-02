#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Aplicando migrações Prisma..."
  npx prisma migrate deploy
else
  echo "DATABASE_URL ausente — pulando migrate deploy"
fi

exec node dist/src/main.js
