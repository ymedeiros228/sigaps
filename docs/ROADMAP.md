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
| **Cadastros** | ✅ Forte | UBS, bairros, ACS (manual + CSV), microáreas com vínculo ACS/UBS/bairro |
| **Dashboard** | ✅ Bom | Cards, gráficos, cobertura %, histórico de alterações |
| **Administração** | ✅ Bom | Backup JSON export/import, lista de usuários, auditoria paginada (`admin@...`) |
| **Infra** | ✅ Bom | JWT, PostGIS, deploy Render, multi-município no schema |
| **Integrações gov** | ⏳ Não iniciado | e-SUS, CNES, IBGE |
| **Mobile / PWA** | ⏳ Não iniciado | — |

---

## Gaps críticos (bloqueiam uso pleno)

1. **Ruas não vinculadas a bairros** — Import OSM não preenche `neighborhoodId`. Sem isso: busca por bairro vazia, “pintar bairro” não funciona, centralizador da microárea no mapa não dá zoom.
2. **Famílias/habitantes zerados** — Campos existem no schema; falta edição manual ou importação até integração e-SUS.
3. **Foto do ACS** — Campo `photoUrl` existe; falta upload na UI (layout dos cards aguarda referência visual do Jonas).
4. **Gestão de usuários** — Admin só lista; não cria/edita/desativa usuários nem reseta senha.
5. **Auditoria incompleta** — Só pintura de ruas gera log; cadastros (ACS, UBS, microárea) não.
6. **Documentação desatualizada** — `README` e `ANALISE_PROPOSTA.md` ainda descrevem MVP antigo.

---

## Melhorias por prioridade

### 🔴 Crítico

| # | Melhoria | Por quê |
|---|----------|---------|
| C1 | Vincular ruas ↔ bairros (UI + import CSV/GeoJSON com coluna bairro) | Desbloqueia mapa por bairro e centralizador da microárea |
| C2 | Import OSM com tag de bairro quando existir no OSM | Automatiza parte da malha territorial |
| C3 | Checklist operacional “ACS sem microárea” com ação direta | Jonas precisa fechar vínculos em massa |
| C4 | Atualizar documentação interna e guia rápido da equipe | Alinhar expectativa com o que o sistema faz hoje |

### 🟠 Alto

| # | Melhoria | Por quê |
|---|----------|---------|
| A1 | Upload de foto do ACS + ajuste visual dos cards | Identificação humana da equipe |
| A2 | CRUD de usuários no Admin (criar, desativar, reset senha) | Governança sem depender de dev |
| A3 | Marcadores de UBS no mapa + legenda | Referência visual da rede |
| A4 | Auditoria em todos os cadastros (CREATE/UPDATE/DELETE) | Rastreabilidade em ambiente público |
| A5 | Edição/import de famílias e habitantes por rua | Dashboard e mapa de calor úteis |
| A6 | Homologação do PDF A3 com a SMS | Aceite formal do mapa oficial |
| A7 | Relatório exportável ACS × microárea × UBS × bairro | Planilha para gestão |

### 🟡 Médio

| # | Melhoria | Por quê |
|---|----------|---------|
| M1 | CPF mascarado na API por perfil (LGPD) | ENFERMEIRO/ACS não precisam ver CPF completo |
| M2 | Perfil ACS read-only (ver só sua microárea) | Agente no campo |
| M3 | Relatório “cobertura por ACS” (% ruas + famílias) | Gestão territorial |
| M4 | Servidor sempre ligado ou aviso proativo no login | Eliminar cold start Render (~60s) |
| M5 | Export KML/SVG restantes | Fase 3 da proposta original |
| M6 | Backup automatizado agendado (além do manual) | Segurança operacional |
| M7 | Performance para > 2000 ruas | Escala municipal |

### 🟢 Baixo / futuro

| # | Melhoria |
|---|----------|
| B1 | Integração e-SUS APS (famílias) |
| B2 | Integração CNES (UBS) |
| B3 | PWA offline para ACS em campo |
| B4 | Multi-município na UI (trocar município no login) |
| B5 | Domínio institucional `.gov.br` |
| B6 | Importação Shapefile (SHP) |

---

## Planejamento por sprint

### Sprint 1 — Território de ponta a ponta (1–2 semanas)

**Objetivo:** Jonas navega o mapa por bairro e pinta microáreas com vínculos completos.

- [ ] C1 — Tela para atribuir bairro a ruas (individual, seleção múltipla)
- [ ] C1 — Import GeoJSON/CSV com coluna `bairro`
- [ ] C2 — Enriquecer import OSM com tags de bairro quando disponíveis
- [ ] Testar centralizador microárea → bairro com dados reais de Passagem Franca
- [ ] C3 — Checklist “ACS sem microárea” no dashboard e cadastros
- [ ] C4 — Atualizar README e `ANALISE_PROPOSTA.md`

**Critério de aceite:** Selecionar microárea com bairro vinculado → mapa centraliza no bairro; busca “Centro” lista ruas; “pintar bairro” funciona.

---

### Sprint 2 — Equipe e governança (2 semanas)

**Objetivo:** Secretaria opera cadastros e usuários sem desenvolvedor.

- [ ] A1 — Upload foto ACS + refinamento cards (com referência do Jonas)
- [ ] A2 — CRUD usuários no Admin
- [ ] A4 — Auditoria em cadastros (ACS, UBS, microárea, bairro)
- [ ] A7 — Export planilha ACS × microárea × UBS

**Critério de aceite:** 15 ACS importados via CSV, todos vinculados; admin cria conta do coordenador; auditoria mostra quem cadastrou cada ACS.

---

### Sprint 3 — Indicadores e documento oficial (2 semanas)

**Objetivo:** Dashboard e PDF úteis para reunião da SMS.

- [ ] A5 — Edição ou import CSV de famílias/habitantes por rua
- [ ] Mapa de calor com dados reais (toggle já existe)
- [ ] A6 — Homologação PDF A3 impresso com logo Passagem Franca
- [ ] A3 — Marcadores UBS no mapa

**Critério de aceite:** Dashboard com famílias > 0; PDF aceito na reunião; UBS visíveis no mapa.

---

### Sprint 4 — Produção confiável (3–4 semanas)

**Objetivo:** Uso diário sem fricção.

- [ ] M4 — Plano pago Render ou keep-alive documentado
- [ ] M6 — Backup automatizado semanal
- [ ] M7 — Otimização ruas > 2000
- [ ] M1 — CPF mascarado na API por perfil

**Critério de aceite:** Abertura < 5s em horário de pico; backup semanal documentado.

---

### Sprint 5+ — Integrações e escala (contínuo)

- [ ] B1 — Piloto e-SUS (famílias por microárea)
- [ ] B2 — CNES (validação UBS)
- [ ] B3 — PWA / perfil ACS mobile
- [ ] B4 — Segundo município na UI

---

## Histórico de fases (referência)

### Fase 1 — MVP (Jun/2026) — ✅ Concluída

Mapa, pintura, OSM, JWT, dashboard básico, PostGIS, Docker.

### Fase 2 — Cadastros e importação (Jul/2026) — ✅ Concluída

UBS, ACS, bairros, microáreas, GeoJSON/KML/CSV, busca unificada, gráficos, cadastro ACS manual + CSV, admin + backup, vínculo microárea↔ACS↔UBS↔bairro.

### Fase 3 — Relatórios oficiais — 🟡 Parcial

- [x] PDF A4/A3 com logo, legenda, rosa dos ventos, QR
- [x] Mapa de calor (estrutura; dados ainda zerados)
- [ ] Export KML, SVG
- [ ] Homologação SMS

### Fase 4 — Integrações governamentais — ⏳ Planejada

### Fase 5 — Mobile e offline — ⏳ Planejada

---

## Critérios de aceite por fase (originais)

| Fase | Critério |
|------|----------|
| 1 | Enfermeiro importa ruas, pinta microáreas e vê cobertura no dashboard |
| 2 | Secretário cadastra UBS/ACS e importa geometrias |
| 3 | PDF A3 aceito pela SMS como mapa oficial |
| 4 | Famílias sincronizadas com e-SUS |
| 5 | ACS consulta microárea no celular offline |

---

## Resumo para decisão

| Prioridade imediata | Impacto |
|---------------------|---------|
| **Ruas ↔ bairros** | Desbloqueia 80% do fluxo territorial que o Jonas pediu |
| **ACS + vínculos** | Já funciona; falta popular dados e foto |
| **Famílias/habitantes** | Transforma dashboard de “bonito” para “útil” |
| **CRUD usuários** | Autonomia da secretaria |

O núcleo da proposta — **organizar microáreas sobre ruas reais** — está entregue. O próximo salto de valor é **completar a malha territorial (bairros)** e **dados da equipe e famílias**.
