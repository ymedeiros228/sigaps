#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "Aplicando migrações Prisma..."
  sh scripts/migrate-deploy.sh
else
  echo "DATABASE_URL ausente — pulando migrate deploy"
fi

exec node dist/src/main.js
