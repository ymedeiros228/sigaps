# SIGAPS — Código-fonte (legado) — Passagem Franca/MA

Pacote entregue a **Jonas Almeida Medeiros** com o código completo do sistema em produção.

## O que está neste ZIP

| Pasta / arquivo | Conteúdo |
|-----------------|----------|
| `backend/` | API NestJS, Prisma, PostGIS, integrações |
| `frontend/` | React, mapa, pintura, dashboard, PWA |
| `docs/` | Manual, roadmap, API, deploy |
| `scripts/` | Utilitários de build, deploy e testes |
| `docker-compose.yml` | Ambiente local com Postgres |
| `render.yaml` | Referência de deploy Render |

**Não inclui:** `node_modules/`, builds (`dist/`), `.env` com senhas, backups de produção.

## Produção (uso diário)

- **Site:** https://sigaps-api.onrender.com/mapa  
- **Login Jonas:** `jonas@passagemfranca.ma.gov.br`  
- **Senha inicial:** `Sigaps@2026` (altere após primeiro acesso)

## Rodar no seu computador (desenvolvedor)

Requisitos: Node 20+, Docker (Postgres/PostGIS).

```bash
# 1. Banco
docker compose up -d db

# 2. Backend
cd backend
cp .env.example .env   # ajuste DATABASE_URL
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run start:dev

# 3. Frontend (outro terminal)
cd frontend
npm ci
npm run dev
```

Acesse http://localhost:5173

Documentação completa: `docs/manual/MANUAL_ENTREGA.md` e `README.md`.

## Suporte técnico

Desenvolvedor: Yuri Medeiros Bandeira  
Repositório original: https://github.com/ymedeiros228/sigaps

## Versão deste pacote

Veja `ENTREGA-VERSAO.txt` na raiz do ZIP (commit Git e data de geração).

---

*Este código é o legado do MVP entregue. A operação diária (pintar o mapa) é feita pelo site em produção; o fonte serve para auditoria, evolução futura ou outro desenvolvedor.*
