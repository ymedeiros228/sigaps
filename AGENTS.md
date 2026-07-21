# SIGAPS

Sistema web GIS para gestão das microáreas da APS. Monorepo com um único produto: API NestJS (`backend/`) + SPA React/Vite (`frontend/`) sobre PostgreSQL + PostGIS.

Comandos padrão de setup/execução estão no [README.md](README.md) (seções "Início Rápido" e "Testes E2E"). Esta seção cobre apenas o que é específico/não óbvio para agentes.

## Cursor Cloud specific instructions

### Serviços
- **PostgreSQL 16 + PostGIS 3.4** — banco (porta 5432). Neste ambiente o Postgres é instalado **nativamente** (não via Docker; não há Docker no VM). Garanta que o cluster esteja no ar antes de rodar backend/testes/seed: `sudo pg_ctlcluster 16 main start` (idempotente; ignore "already running"). Banco `sigaps`, usuário `sigaps` / senha `sigaps_secret`, PostGIS habilitado — bate com o `DATABASE_URL` do `.env`.
- **Backend (NestJS)** — `cd backend && npm run start:dev` → API em `:3000` (Swagger em `/docs`). Watch mode funciona normalmente.
- **Frontend (Vite dev)** — `cd frontend && npm run dev` → SPA em `:5173`.

### Variáveis de ambiente (gitignored)
- Necessários: `.env` (raiz), `backend/.env` e `frontend/.env` (crie a partir dos `*.example` se faltarem).
- O backend lê o `.env` do **diretório atual** (`ConfigModule.forRoot`), então rodá-lo a partir de `backend/` exige o `backend/.env` (cópia do `.env` da raiz). Sem ele o app sobe sem `DATABASE_URL` e não conecta.

### Gotcha: `npm run lint` do backend usa `--fix`
- O script `backend` `lint` é `eslint ... --fix`, ou seja **altera arquivos-fonte** ao rodar. Ele pode inclusive quebrar o `build`/`start:dev` (ex.: remover um cast `as object`/`as Prisma.InputJsonValue` tido como "desnecessário", gerando erro de tipo). Se rodar para checagem, reverta depois (`git checkout -- backend/src`). O `build` do código original passa limpo.

### Frontend
- O Vite faz bind apenas em **localhost IPv6**; acesse por `http://localhost:5173` (não `127.0.0.1`). O dev server faz proxy de `/api` → `:3000`.
- `VITE_DEV_AUTO_LOGIN=true` (padrão em dev) faz login automático com o usuário do seed.

### Lint / Test / Build
- Backend: `npm test` (Jest, 34 testes passam) e `npm run build` (passa no código original). `npm run lint` — ver gotcha acima; há erros de estilo pré-existentes no código.
- Frontend: `npm run lint` (Oxlint, apenas warnings) e `npm run build`.
- E2E (opcional): `bash scripts/ci-e2e.sh` com Postgres no ar; instala o Chromium do Playwright.

### Seed
Migrações + seed: `cd backend && npx prisma migrate deploy && npm run prisma:seed`. Credenciais: `jonas@passagemfranca.ma.gov.br` / `Sigaps@2026` (também `admin@passagemfranca.ma.gov.br`).
