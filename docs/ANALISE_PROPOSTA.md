# SIGAPS — Análise da Proposta vs. Implementação Atual

**Data:** Jul/2026  
**Cliente:** Jonas Almeida Medeiros — Passagem Franca/MA  
**Versão do sistema:** Sprints 1–7 (pós-MVP)

---

## Resumo executivo

A proposta descreve um **sistema GIS municipal completo** para gestão territorial das microáreas da APS. O sistema já entrega o **núcleo funcional e a maior parte das fases 2–5**: mapa real com ruas OSM, cadastros completos, pintura territorial, dashboard com relatórios, PDF oficial, PWA, integrações piloto e suporte multi-município.

Pendências principais: homologação formal do PDF pela SMS, integração e-SUS automática (além do piloto CSV) e segundo município em produção.

---

## Matriz de conformidade

| Módulo | Proposta | Status | Observação |
|--------|----------|--------|------------|
| **Stack open source** | React, NestJS, PostGIS, Docker | ✅ Implementado | 100% gratuito |
| **Autenticação JWT** | Login + perfis | ✅ Implementado | 5 perfis |
| **Refresh Token** | Sim | ✅ Implementado | Renovação automática no frontend |
| **Dashboard** | Indicadores + gráficos | ✅ Implementado | Cards, gráficos, cobertura por ACS, audit |
| **Cadastro Municípios** | CRUD completo | 🟡 Parcial | Schema + seed + seletor UI; sem CRUD admin |
| **Cadastro UBS** | CRUD | ✅ Implementado | API + UI + marcadores no mapa |
| **Cadastro Bairros** | CRUD | ✅ Implementado | API + UI + vinculação em massa |
| **Cadastro ACS** | CRUD + foto | ✅ Implementado | Manual, CSV, foto, checklist sem microárea |
| **Cadastro Microáreas** | CRUD | ✅ Implementado | Vínculo ACS/UBS/bairro, export planilha |
| **Mapa fullscreen** | Layout limpo | ✅ Implementado | Toolbar flutuante |
| **Camadas** | Mapa, Satélite, Relevo, Híbrido | ✅ Implementado | OSM, Esri, OpenTopoMap |
| **Busca unificada** | Rua, bairro, UBS, ACS | ✅ Implementado | Autocomplete com zoom |
| **Importação OSM** | Overpass API | ✅ Implementado | Com enriquecimento de bairro quando disponível |
| **Vincular rua → microárea** | Com cor automática | ✅ Implementado | |
| **Regra 1 rua = 1 microárea** | Com diálogo transferência | ✅ Implementado | |
| **Modo Pincel** | Pintar Microárea | ✅ Implementado | Borracha e zonas circulares |
| **Seleção múltipla** | Várias ruas no mapa | ✅ Implementado | Ctrl+clique |
| **Polígono automático** | PostGIS convex hull | ✅ Implementado | Toggle no mapa |
| **Info da rua** | Painel lateral | ✅ Implementado | StreetPanel + famílias |
| **Sugestão por proximidade** | PostGIS ST_Distance | ✅ Implementado | |
| **Audit log** | Quem/quando/antes/depois | ✅ Implementado | Cadastros + pintura + admin |
| **Swagger** | Documentação API | ✅ Implementado | `/docs` |
| **Docker produção** | Compose + Nginx | ✅ Implementado | |
| **Modo claro/escuro** | Sim | ✅ Implementado | |
| **Importação GeoJSON/KML/CSV** | Fase 2 | ✅ Implementado | Ruas, ACS, famílias, bairros |
| **Exportação PDF/PNG/GeoJSON** | Fase 2–3 | ✅ Implementado | PDF A4/A3 oficial |
| **PDF oficial A4/A3** | Logo, legenda, QR | ✅ Implementado | Homologação SMS pendente |
| **Mapa de calor / estatísticas** | Fase 2 | ✅ Implementado | Por famílias |
| **Integrações e-SUS/CNES** | Fase 4 | 🟡 Piloto | CNES consulta; e-SUS import CSV |
| **App mobile / offline** | Fase 5 | ✅ Implementado | PWA instalável |
| **Multi-município** | Escalabilidade | ✅ Implementado | Seletor na UI |
| **Relatório cobertura ACS** | Gestão territorial | ✅ Implementado | Sprint 7 |
| **LGPD CPF** | Controle por perfil | ✅ Implementado | Mascaramento na API |
| **Backup automatizado** | Segurança | ✅ Implementado | Cron semanal no Render |

**Legenda:** ✅ Concluído · 🟡 Parcial · ⏳ Planejado

---

## Análise crítica da proposta

### Pontos fortes da proposta

1. **Foco GIS real** — OSM como malha viária evita desenho manual impreciso.
2. **Arquitetura multi-município** — `Municipality` como tenant lógico escala bem.
3. **PostGIS nativo** — Geometrias + consultas espaciais são a escolha correta.
4. **Audit log** — Essencial para ambiente público e LGPD.
5. **100% open source** — Viável sem custos de licenciamento.

### Ajustes realizados (sem alterar o objetivo)

| Item original | Implementação | Motivo |
|---------------|---------------|--------|
| IA generativa | Proximidade geográfica PostGIS | Previsível, auditável, sem custo |
| PDF com QR Code | Fase 3 (entregue) | Layout complexo exigiu sprint dedicado |
| Cadastro Famílias | e-SUS piloto CSV + edição manual | Integração API completa em roadmap |
| Integração e-SUS | Piloto CSV primeiro | Reduz risco antes de API oficial |

### Riscos remanescentes

1. **Cobertura OSM** — Nem todas as ruas existem no OSM; GeoJSON/CSV complementam.
2. **Cold start Render** — Mitigado com keep-alive; plano pago elimina o problema.
3. **LGPD** — CPF mascarado; revisar periodicamente novos endpoints.

---

## Roadmap recomendado (atualizado)

### Fase 1 — MVP — ✅ Concluída

### Fase 2 — Cadastros e dados — ✅ Concluída

### Fase 3 — Relatórios oficiais — 🟡 Parcial (homologação SMS)

### Fase 4 — Integrações — 🟡 Piloto (e-SUS CSV + CNES)

### Fase 5 — Mobile e offline — ✅ Concluída (PWA)

### Próximos passos

- Homologação PDF A3 com a SMS
- Integração e-SUS automática (API)
- Segundo município em produção
- Domínio `.gov.br`

---

## Conclusão

A proposta é **técnica e operacionalmente viável**. O sistema já demonstra o diferencial principal — **organizar microáreas sobre ruas reais no mapa** — e cobre cadastros, indicadores, documentos oficiais, PWA e integrações piloto. A continuidade deve priorizar **homologação do PDF**, **dados reais de famílias** e **integração e-SUS completa**.
