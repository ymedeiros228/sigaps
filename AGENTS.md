# SIGAPS

Sistema web GIS para gestão das microáreas da APS. Monorepo com um único produto: API NestJS (`backend/`) + SPA React/Vite (`frontend/`) sobre PostgreSQL + PostGIS.

Comandos padrão de setup/execução estão no [README.md](README.md) (seções "Início Rápido" e "Testes E2E"). Esta seção cobre apenas o que é específico/não óbvio para agentes.

## Cursor Cloud specific instructions

### Serviços
- **PostgreSQL 16 + PostGIS 3.4** — banco (porta 5432). Neste ambiente o Postgres é instalado **nativamente** (não via Docker; não há Docker no VM). Garanta que o cluster esteja no ar antes de rodar o backend/testes: `sudo pg_ctlcluster 16 main start` (idempotente; ignore "already running"). Banco `sigaps`, usuário `sigaps` / senha `sigaps_secret`, PostGIS já habilitado — bate com `DATABASE_URL` do `.env`.
- **Backend (NestJS)** — API em `:3000`. Rodar de dentro de `backend/`.
- **Frontend (Vite dev)** — SPA em `:5173`.

### Variáveis de ambiente (gitignored)
- Necessários: `.env` (raiz), `backend/.env` e `frontend/.env` (crie a partir dos `*.example` se faltarem).
- O backend lê o `.env` do **diretório atual** (`ConfigModule.forRoot`), então rodá-lo a partir de `backend/` exige o `backend/.env` (cópia do `.env` da raiz). Sem ele, o app sobe sem `DATABASE_URL`.

### Rodar a API (caveat de build)
- `backend` `npm run build` e `npm run start:dev` fazem **type-check** e atualmente falham em **1 erro pré-existente** em `src/modules/paint-zones/paint-zones.service.ts` (o `geojson` precisa de `as Prisma.InputJsonValue`, como já é feito em `streets.service.ts`). É um problema de código, não de ambiente — não corrigir aqui.
- O `nest build` **ainda emite** `dist/` apesar do erro; já o `start:dev` (watch) **não sobe** o processo enquanto houver erro de tipo. Portanto, para subir a API neste ambiente: `cd backend && npm run build && npm run start:prod` (ou `node dist/src/main.js`). Use `NODE_ENV=development` para manter o Swagger em `/docs`.

### Frontend
- `cd frontend && npm run dev`. O Vite faz bind apenas em **localhost IPv6**; acesse por `http://localhost:5173` (não `127.0.0.1`). O dev server faz proxy de `/api` → `:3000`.
- `VITE_DEV_AUTO_LOGIN=true` (padrão em dev) faz login automático com o usuário do seed.

### Lint / Test
- Backend: `npm test` (Jest, passa). `npm run lint` (ESLint) tem erros pré-existentes no código.
- Frontend: `npm run lint` (Oxlint, apenas warnings) e `npm run build`.
- E2E (opcional): `bash scripts/ci-e2e.sh` com Postgres no ar; ele instala o Chromium do Playwright (`npx playwright install chromium`).

### Seed
Migrações + seed: `cd backend && npx prisma migrate deploy && npm run prisma:seed`. Credenciais do seed: `jonas@passagemfranca.ma.gov.br` / `Sigaps@2026` (também `admin@passagemfranca.ma.gov.br`).
