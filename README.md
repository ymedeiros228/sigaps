# SIGAPS — Sistema Inteligente de Gestão das Microáreas da APS

[![Stack](https://img.shields.io/badge/stack-100%25%20open%20source-green)](LICENSE)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Sistema web GIS profissional para gestão territorial das microáreas dos Agentes Comunitários de Saúde (ACS), desenvolvido para a **Prefeitura Municipal de Passagem Franca - MA** e preparado para escalar a qualquer município brasileiro.

**Cliente:** Jonas Almeida Medeiros — Enfermeiro responsável pelo planejamento da APS

---

## Deploy na web (gratuito)

Guia passo a passo: [docs/DEPLOY_GRATUITO.md](docs/DEPLOY_GRATUITO.md)  
Limitações para usuários: [docs/LIMITACOES_PLANO_GRATUITO.md](docs/LIMITACOES_PLANO_GRATUITO.md)

Stack sugerida: **Supabase** (banco) + **Render** (API) + **Cloudflare Pages** (site).  
Variáveis de exemplo: `.env.production.example` | Blueprint: `render.yaml`

**Produção (Sprint 4):** o frontend envia ping periódico em `/health` para reduzir cold start. No backend, `RENDER_EXTERNAL_URL` ativa keep-alive automático; `AUTO_BACKUP_ENABLED=false` desliga o cron semanal. Backups automáticos ficam em `uploads/backups/` (disco efêmero no Render gratuito — baixe via Administração).

---
| Documento | Descrição |
|-----------|-----------|
| [Documentação Completa (PDF)](docs/SIGAPS_Documentacao_Completa.pdf) | Manual detalhado do projeto |
| [Análise da Proposta](docs/ANALISE_PROPOSTA.md) | Conformidade proposta vs. implementação |
| [Arquitetura](docs/ARQUITETURA.md) | Diagramas e decisões técnicas |
| [Roadmap](docs/ROADMAP.md) | Fases de desenvolvimento |
| [API REST](docs/API.md) | Referência de endpoints |
| [Swagger](http://localhost:3000/docs) | Documentação interativa (com API rodando) |

---

## Stack (100% Open Source)

| Camada | Tecnologias |
|--------|-------------|
| Frontend | React, TypeScript, Vite, Material UI, React Leaflet, Zustand, TanStack Query |
| Backend | NestJS, Prisma, JWT, Swagger |
| Banco | PostgreSQL + PostGIS |
| Mapas | OpenStreetMap, Nominatim, Overpass API, Esri World Imagery |
| Infra | Docker, Docker Compose, Nginx |

---

## Funcionalidades

- Autenticação JWT com perfis (Administrador, Secretário, Coordenador, Enfermeiro, ACS) e refresh automático
- **Multi-município** — troca de contexto na UI para escalar além de Passagem Franca/MA
- Dashboard com indicadores, gráficos, cobertura territorial, relatório **cobertura por ACS** e histórico de alterações
- Mapa interativo com camadas OSM, satélite e relevo
- Importação de ruas via OpenStreetMap (Overpass API) e enriquecimento com bairro quando disponível
- Vinculação de ruas a microáreas e bairros (individual, seleção múltipla, import CSV/GeoJSON)
- Modo **Pintar Microárea** (pincel), borracha, zonas circulares e conflito 1 rua = 1 microárea
- Cadastros CRUD: UBS, bairros, ACS (manual + CSV + foto), microáreas com vínculo ACS/UBS/bairro
- Famílias e habitantes por rua (edição manual + import CSV piloto e-SUS)
- Exportação: PDF oficial A4/A3, PNG/JPEG, GeoJSON, KML, SVG e planilhas CSV
- Mapa de calor por densidade de famílias
- Marcadores de UBS no mapa
- **PWA** — instalável no celular, cache offline para ACS em campo
- Integrações piloto: consulta **CNES** e importação CSV **e-SUS**
- Administração: CRUD de usuários, backup manual/automático, auditoria paginada
- LGPD: CPF mascarado na API conforme perfil
- API documentada via Swagger
- **Segurança:** escopo por município, rate limiting, SQL parametrizado, CPF mascarado em auditoria

Detalhamento e próximos passos: [ROADMAP.md](docs/ROADMAP.md)

---

## Estrutura do Projeto

```
sigaps/
├── backend/          # NestJS API
├── frontend/         # React SPA
├── docs/             # Documentação + PDF
├── scripts/          # Utilitários
├── nginx/            # Reverse proxy
├── docker-compose.yml
└── README.md
```

---

## Início Rápido

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (recomendado)

### 1. Configurar

```bash
cd sigaps
cp .env.example .env
```

### 2. Banco (Docker)

```bash
docker compose up postgres -d
```

### 3. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

API: http://localhost:3000 · Swagger: http://localhost:3000/docs

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

### 5. Produção

```bash
docker compose up -d --build
```

Acesse: http://localhost

### Gerar PDF da documentação

```bash
npm install
npm run docs:pdf
```

---

## Credenciais padrão (seed)

| Campo | Valor |
|-------|-------|
| Email | jonas@passagemfranca.ma.gov.br |
| Senha | Sigaps@2026 |

---

## Fluxo principal

1. Faça login no sistema
2. Acesse **Mapa** → clique em **Importar Ruas OSM**
3. Pesquise uma rua ou clique diretamente nela
4. Vincule à microárea desejada — a rua será pintada automaticamente
5. Use **Pintar Microárea** para modo pincel contínuo
6. Use **Ctrl+clique** para selecionar várias ruas de uma vez

---

## Licença

[MIT](LICENSE) — Código aberto para uso e replicação em municípios brasileiros.

---

Desenvolvido para a **Secretaria Municipal de Saúde de Passagem Franca - Maranhão**.
