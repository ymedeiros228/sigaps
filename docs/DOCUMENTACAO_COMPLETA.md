# SIGAPS — Documentação Completa do Projeto

**Sistema Inteligente de Gestão das Microáreas da Atenção Primária à Saúde**

| Campo | Valor |
|-------|-------|
| Cliente | Jonas Almeida Medeiros |
| Município piloto | Passagem Franca — Maranhão |
| Versão | 1.0.0-MVP |
| Data | 30 de junho de 2026 |
| Licença | MIT (código aberto) |

---

## 1. Introdução

### 1.1 Contexto

A Atenção Primária à Saúde (APS) no Brasil organiza o território em **microáreas**, cada uma atendida por um Agente Comunitário de Saúde (ACS). O planejamento territorial exige mapas precisos que relacionem ruas, bairros e equipes — tarefa hoje feita manualmente em planilhas ou desenhos imprecisos.

O **SIGAPS** resolve esse problema com um sistema GIS web profissional: o enfermeiro ou coordenador trabalha diretamente sobre o mapa real do município, vinculando ruas oficiais (OpenStreetMap) às microáreas com cores automáticas.

### 1.2 Objetivo geral

Desenvolver plataforma web escalável para gestão territorial das microáreas da APS, inicialmente em Passagem Franca/MA, preparada para qualquer município brasileiro.

### 1.3 Objetivo específico (MVP)

- Carregar ruas reais via OpenStreetMap
- Permitir vinculação visual rua → microárea
- Modo pincel para pintura rápida
- Indicadores de cobertura territorial
- Rastreabilidade de alterações (audit log)
- Stack 100% gratuita e open source

---

## 2. Requisitos funcionais

### 2.1 Autenticação e perfis

O sistema possui login com JWT e cinco perfis:

1. **Administrador** — gestão total do sistema
2. **Secretário de Saúde** — gestão municipal
3. **Coordenador APS** — microáreas e equipes
4. **Enfermeiro** — operação do mapa e importação OSM
5. **ACS** — consulta (leitura)

Tokens: access (15 min) + refresh (7 dias).

### 2.2 Dashboard

Exibe em tempo real:

- Total de UBS, ACS, microáreas, ruas
- Total de famílias e habitantes (campos preparados)
- Percentual de cobertura (ruas vinculadas / total)
- Histórico recente de alterações
- Gráfico por microárea (planejado Fase 2)

### 2.3 Mapa interativo

**Layout:** ocupa quase toda a tela; toolbar flutuante minimalista.

**Ferramentas:**

| Ferramenta | Função |
|------------|--------|
| Pesquisa | Autocomplete de ruas |
| Camadas | Mapa, Satélite, Relevo |
| Pintar Microárea | Modo pincel — clique pinta rua |
| Polígonos | Toggle de envelopes das microáreas |
| Importar OSM | Baixa vias do município |
| Tela cheia | Fullscreen API |
| Escala | ScaleControl Leaflet |

### 2.4 Fluxo principal

```
Login → Mapa → Importar Ruas OSM → Pesquisar/clicar rua → Vincular microárea → Rua colorida
```

**Modo pincel:** selecionar microárea → ativar "Pintar" → cada clique em rua a vincula instantaneamente.

**Conflito:** se rua já pertence a outra microárea, sistema pergunta se deseja transferir.

### 2.5 Polígono automático

PostGIS calcula `ST_ConvexHull(ST_Collect(geom))` das ruas de cada microárea. Polígono semi-transparente apenas para visualização; pode ser ligado/desligado.

### 2.6 Sugestão inteligente

Endpoint `/streets/:id/suggest-microarea` usa distância geográfica (`ST_Distance`) entre a rua não vinculada e ruas já atribuídas, retornando as 3 microáreas mais próximas.

### 2.7 Histórico (audit log)

Toda vinculação registra:

- Usuário
- Data/hora
- Entidade (rua)
- Ação (`ASSIGN_MICROAREA`)
- Estado anterior e posterior

---

## 3. Requisitos não funcionais

| Requisito | Implementação |
|-----------|---------------|
| Performance | Paginação até 2000 ruas; índices GIST |
| Segurança | JWT, roles, bcrypt, audit |
| LGPD | Controle por perfil; logs auditáveis |
| Escalabilidade | Multi-município via `municipalityId` |
| Disponibilidade | Docker + healthcheck PostgreSQL |
| UX | MUI + modo escuro; inspirado ArcGIS/QGIS |
| Documentação | README, Swagger, docs/ |
| Custo zero | Sem Google Maps / Mapbox |

---

## 4. Modelo de dados

### 4.1 Entidades principais

```
Municipality 1──* Microarea 1──* Street
              1──* Ubs
              1──* Acs
              1──* Neighborhood 1──* Street
User 1──* AuditLog
Microarea 1──1 Acs (opcional)
```

### 4.2 Campos geoespaciais

| Entidade | Campo JSON | Campo PostGIS |
|----------|------------|---------------|
| Street | `geojson` (LineString) | `geom` (LineString, 4326) |
| Microarea | — | `envelope_geom` (Polygon, 4326) |

### 4.3 Cores padrão das microáreas (seed)

| Microárea | Cor |
|-----------|-----|
| 01 | Verde `#4CAF50` |
| 02 | Laranja `#FF9800` |
| 03 | Azul `#2196F3` |
| 04 | Roxo `#9C27B0` |
| 05 | Vermelho `#F44336` |

---

## 5. Arquitetura de software

### 5.1 Stack

- **Frontend:** React 19, TypeScript, Vite, MUI, React Leaflet, Zustand, TanStack Query
- **Backend:** NestJS, Prisma, Passport JWT, Swagger
- **Banco:** PostgreSQL 16 + PostGIS 3.4
- **Infra:** Docker Compose, Nginx

### 5.2 Estrutura de pastas

```
sigaps/
├── backend/src/modules/     # Domínios NestJS
├── backend/prisma/          # Schema + migrations + seed
├── frontend/src/
│   ├── components/map/      # GIS
│   ├── pages/               # Telas
│   ├── services/            # API client
│   └── store/               # Zustand
├── docs/                    # Documentação
├── nginx/                   # Proxy
├── scripts/                 # Utilitários (PDF)
└── docker-compose.yml
```

### 5.3 Integrações externas

| API | URL | Uso |
|-----|-----|-----|
| OSM Tiles | tile.openstreetmap.org | Mapa base |
| Esri Imagery | server.arcgisonline.com | Satélite |
| OpenTopoMap | tile.opentopomap.org | Relevo |
| Nominatim | nominatim.openstreetmap.org | Bbox município |
| Overpass | overpass-api.de | Importação vias |

---

## 6. Instalação e execução

### 6.1 Pré-requisitos

- Node.js 20+
- Docker Desktop (recomendado)

### 6.2 Desenvolvimento local

```bash
# 1. Configurar ambiente
cp .env.example .env

# 2. Banco de dados
docker compose up postgres -d

# 3. Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev

# 4. Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

**URLs:**

- App: http://localhost:5173
- API: http://localhost:3000
- Swagger: http://localhost:3000/docs

### 6.3 Produção

```bash
docker compose up -d --build
```

Acesso: http://localhost

### 6.4 Credenciais padrão

| Campo | Valor |
|-------|-------|
| Email | jonas@passagemfranca.ma.gov.br |
| Senha | Sigaps@2026 |

---

## 7. Análise da proposta original

### 7.1 Conformidade MVP (~75%)

Implementado: mapa, OSM, microáreas, pintura, conflitos, PostGIS, auth, dashboard básico, audit backend, Docker, Swagger.

Pendente Fase 2+: CRUDs UI, PDF oficial, import/export avançado, integrações e-SUS.

### 7.2 Recomendações

1. Priorizar cadastros UBS/ACS antes de PDF
2. Manter "IA" como proximidade PostGIS (auditável, gratuito)
3. Permitir cadastro manual de ruas ausentes no OSM
4. Implementar clustering para >5000 ruas

---

## 8. Roadmap

| Fase | Período | Entregas |
|------|---------|----------|
| 1 MVP | Jun/2026 | Mapa, OSM, microáreas, auth |
| 2 Cadastros | Jul–Ago/2026 | CRUDs, GeoJSON, gráficos |
| 3 Relatórios | Set/2026 | PDF A4/A3 oficial |
| 4 Integrações | 2026–27 | e-SUS, CNES, IBGE |
| 5 Mobile | 2027 | PWA offline |

---

## 9. Segurança e LGPD

- Senhas com bcrypt (10 rounds)
- JWT com secrets em variáveis de ambiente
- CPF de ACS visível apenas para perfis autorizados
- Audit log imutável para rastreabilidade
- HTTPS obrigatório em produção (configurar no Nginx)

---

## 10. Contato e créditos

**Projeto:** SIGAPS  
**Cliente:** Jonas Almeida Medeiros  
**Município:** Passagem Franca — Maranhão  
**Secretaria:** Secretaria Municipal de Saúde  

Desenvolvido com tecnologias open source para uso público municipal e replicação em outros municípios brasileiros.

---

*Documento gerado automaticamente. Versão PDF disponível em `docs/SIGAPS_Documentacao_Completa.pdf`.*
