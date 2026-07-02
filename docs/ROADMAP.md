# SIGAPS — Roadmap e Planejamento

**Última revisão:** Jul/2026  
**Cliente piloto:** Jonas Almeida Medeiros — Passagem Franca/MA

---

## Visão do produto

Sistema GIS web para a Secretaria Municipal de Saúde **organizar o território da APS**: cadastrar equipe (UBS, ACS), definir microáreas, pintar ruas no mapa real, gerar indicadores e documentos oficiais para reuniões da SMS.

**Usuários:** Administrador · Secretário de Saúde · Coordenador APS · Enfermeiro · ACS (consulta).

---

## Estado atual (o que já está pronto)

| Área | Status | Destaques |
|------|--------|-----------|
| **Mapa e pintura** | ✅ Forte | OSM, pincel, borracha, conflito 1 rua = 1 microárea, zonas circulares, PDF, busca unificada |
| **Cadastros** | ✅ Forte | UBS, bairros, ACS (manual + CSV + foto), microáreas com vínculo ACS/UBS/bairro |
| **Dashboard** | ✅ Forte | Cards, gráficos, cobertura %, relatório por ACS, histórico de alterações |
| **Administração** | ✅ Forte | CRUD usuários, backup manual/automático, auditoria paginada |
| **Infra** | ✅ Forte | JWT, PostGIS, deploy Render, multi-município na UI |
| **Integrações gov** | 🟡 Piloto | CNES (consulta), e-SUS (import CSV + sync) |
| **Mobile / PWA** | ✅ Entregue | Instalável, cache offline para ACS |

---

## Gaps remanescentes

1. **Homologação PDF A3** — Layout pronto; falta aceite formal da SMS.
2. **Integração e-SUS completa** — Piloto CSV com re-sincronização automática do último import; API oficial ainda pendente.
3. **Segundo município em produção** — UI multi-município pronta; falta onboarding de outro cliente.
4. **Domínio institucional** — `.gov.br` e servidor sempre ligado (plano pago Render).

---

## Melhorias por prioridade

### 🔴 Crítico

| # | Melhoria | Status |
|---|----------|--------|
| C1 | Vincular ruas ↔ bairros (UI + import CSV/GeoJSON) | [x] |
| C2 | Import OSM com tag de bairro quando existir | [x] |
| C3 | Checklist operacional “ACS sem microárea” | [x] |
| C4 | Atualizar documentação interna | [x] Sprint 7 |

### 🟠 Alto

| # | Melhoria | Status |
|---|----------|--------|
| A1 | Upload de foto do ACS + cards visuais | [x] |
| A2 | CRUD de usuários no Admin | [x] |
| A3 | Marcadores de UBS no mapa | [x] |
| A4 | Auditoria em todos os cadastros | [x] |
| A5 | Edição/import de famílias e habitantes por rua | [x] |
| A6 | Homologação do PDF A3 com a SMS | [ ] |
| A7 | Relatório exportável ACS × microárea × UBS × bairro | [x] |

### 🟡 Médio

| # | Melhoria | Status |
|---|----------|--------|
| M1 | CPF mascarado na API por perfil (LGPD) | [x] |
| M2 | Perfil ACS read-only (ver só sua microárea) | [x] |
| M3 | Relatório “cobertura por ACS” (% ruas + famílias) | [x] Sprint 7 |
| M4 | Keep-alive / aviso cold start Render | [x] |
| M5 | Export KML/SVG | [x] |
| M6 | Backup automatizado agendado | [x] |
| M7 | Performance para > 2000 ruas | [x] |

### 🟢 Baixo / futuro

| # | Melhoria | Status |
|---|----------|--------|
| B1 | Integração e-SUS APS completa (API) | [ ] piloto CSV |
| B2 | Integração CNES (validação UBS) | [x] consulta |
| B3 | PWA offline para ACS em campo | [x] |
| B4 | Multi-município na UI | [x] |
| B5 | Domínio institucional `.gov.br` | [ ] |
| B6 | Importação Shapefile (SHP) | [x] Sprint 9 |

---

## Planejamento por sprint

### Sprint 1 — Território de ponta a ponta — ✅ Concluído

- [x] C1 — Atribuir bairro a ruas (individual, seleção múltipla)
- [x] C1 — Import GeoJSON/CSV com coluna `bairro`
- [x] C2 — Enriquecer import OSM com tags de bairro
- [x] C3 — Checklist “ACS sem microárea”
- [x] C4 — Atualizar README e `ANALISE_PROPOSTA.md`

### Sprint 2 — Equipe e governança — ✅ Concluído

- [x] A1 — Upload foto ACS + cards
- [x] A2 — CRUD usuários no Admin
- [x] A4 — Auditoria em cadastros
- [x] A7 — Export planilha ACS × microárea × UBS

### Sprint 3 — Indicadores e documento oficial — ✅ Concluído

- [x] A5 — Edição/import CSV de famílias/habitantes por rua
- [x] Mapa de calor com dados reais
- [x] A3 — Marcadores UBS no mapa
- [ ] A6 — Homologação PDF A3 (pendente aceite SMS)

### Sprint 4 — Produção confiável — ✅ Concluído

- [x] M4 — Keep-alive documentado + ping frontend
- [x] M6 — Backup automatizado semanal
- [x] M7 — Otimização ruas > 2000
- [x] M1 — CPF mascarado na API por perfil

### Sprint 5 — PWA e exportações — ✅ Concluído

- [x] B3 — PWA instalável com cache offline
- [x] M5 — Export KML e SVG
- [x] M2 — Perfil ACS read-only (sua microárea)

### Sprint 6 — Integrações e multi-município — ✅ Concluído

- [x] B1 — Piloto e-SUS (import CSV famílias/habitantes)
- [x] B2 — Consulta CNES (dados abertos MS)
- [x] B4 — Seletor de município na UI

### Sprint 7 — Relatório ACS e documentação — ✅ Concluído

- [x] M3 — Relatório “cobertura por ACS” (API + dashboard + CSV)
- [x] C4 — Atualizar README, ROADMAP e ANALISE_PROPOSTA

### Sprint 8 — Homologação PDF (A6) — ✅ Concluído

- [x] A6 — Fluxo de homologação SMS (registro admin + carimbo no PDF)
- [x] PDF — Campos de assinatura, legenda no mapa, captura com flyTo

### Sprint 9 — Performance e importações — ✅ Concluído

- [x] B6 — Importação Shapefile (.zip com .shp/.dbf/.shx) via `shpjs`
- [x] M7+ — Carregamento de ruas por viewport/bbox (PostGIS) para municípios com >800 ruas
- [x] Export microáreas — query única (elimina N+1)
- [x] MapDivisionsPanel — debounce no preview do raio (300ms)
- [x] bulkAssignNeighborhood — lookup em lote com `findMany` + `updateMany`

### Sprint 10 — Integração e UX de mapa — ✅ Concluído

- [x] e-SUS sync piloto — reprocessar último CSV importado (`POST /integrations/esus/municipality/:id/sync`)
- [x] `esusLastSyncAt` no município + botão "Sincronizar e-SUS" na área de cadastros
- [x] Dashboard — cache em memória de 30s para indicadores do município
- [x] Mapa — indicador de progresso ao carregar ruas por viewport + dica "Mova o mapa para carregar mais ruas"

### Sprint 11 — Operação e monitoramento — ✅ Concluído

- [x] e-SUS sync agendado semanal (`AUTO_ESUS_SYNC_ENABLED=true`, segundas 04:00)
- [x] Health `GET /health/postgis` — verifica extensão PostGIS e índice espacial das ruas
- [x] Correção de resposta da API e-SUS (`ok`, `message`, `lastSyncAt`)

### Sprint 12 — Checklist e governança — ✅ Concluído

- [x] Checklist operacional no dashboard (9 itens: ruas, microáreas, ACS, cobertura, e-SUS, homologação…)
- [x] `GET /dashboard/municipality/:id/checklist`
- [x] Exportação CSV da auditoria (`GET /admin/.../audit/export.csv`, até 5000 registros)
- [x] Invalidação imediata do cache do dashboard após pintura e-SUS

### Sprint 13 — Homologação e onboarding — ✅ Concluído

- [x] Checklist com links de ação e export CSV
- [x] Flag `readyForHomologation` (críticos + cobertura ≥80%)
- [x] Termo de homologação PDF (Admin → Homologação, após registro)
- [x] Admin homologação integrado ao checklist com aviso de prontidão
- [x] Seletor multi-município com confirmação e indicador de homologação

---

## Histórico de fases (referência)

### Fase 1 — MVP (Jun/2026) — ✅ Concluída

Mapa, pintura, OSM, JWT, dashboard básico, PostGIS, Docker.

### Fase 2 — Cadastros e importação (Jul/2026) — ✅ Concluída

UBS, ACS, bairros, microáreas, GeoJSON/KML/CSV, busca unificada, admin + backup.

### Fase 3 — Relatórios oficiais — 🟡 Parcial

- [x] PDF A4/A3 com logo, legenda, rosa dos ventos, QR
- [x] Mapa de calor
- [x] Export KML, SVG
- [ ] Homologação SMS

### Fase 4 — Integrações governamentais — 🟡 Piloto

- [x] CNES (consulta)
- [x] e-SUS (import CSV piloto + re-sync do último CSV)
- [x] Sincronização automática (piloto re-sync)

### Fase 5 — Mobile e offline — ✅ Concluída

PWA instalável, cache de geometrias para ACS em campo.

---

## Resumo para decisão

| Prioridade imediata | Impacto |
|---------------------|---------|
| **Homologação PDF** | Aceite formal do mapa oficial na SMS |
| **Popular dados reais** | Famílias via e-SUS piloto + pintura territorial |
| **Segundo município** | Validar escala multi-tenant em produção |

O núcleo da proposta — **organizar microáreas sobre ruas reais** — está entregue. O próximo salto é **homologação do PDF** e **integração e-SUS completa**.
