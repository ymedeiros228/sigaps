#!/bin/sh
set -e

# Migrações rodam no GitHub Actions (CI) com conexão direta ao banco.
# No container (DATABASE_URL via pooler 6543) o prisma migrate pode travar,
# então tentamos com timeout curto e seguimos em frente sem bloquear o start.
if [ -n "$DATABASE_URL" ] && [ "${RUN_MIGRATIONS_ON_BOOT:-false}" = "true" ]; then
  echo "Aplicando migrações Prisma (timeout 90s)..."
  timeout 90 sh scripts/migrate-deploy.sh || echo "Aviso: migrate pulado/falhou — CI é a fonte oficial de migrações."
fi

exec node dist/src/main.js
