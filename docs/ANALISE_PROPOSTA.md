# SIGAPS — Análise da Proposta vs. Implementação Atual

**Data:** 30/06/2026  
**Cliente:** Jonas Almeida Medeiros — Passagem Franca/MA  
**Versão do sistema:** MVP (Fase 1)

---

## Resumo executivo

A proposta descreve um **sistema GIS municipal completo** para gestão territorial das microáreas da APS. O MVP já entrega o **núcleo funcional**: mapa real com ruas OSM, vinculação a microáreas, pintura por pincel, conflitos de transferência, PostGIS, autenticação JWT, dashboard básico e audit log no backend.

As fases seguintes cobrem cadastros administrativos completos, importação/exportação avançada, PDF oficial e integrações governamentais.

---

## Matriz de conformidade

| Módulo | Proposta | Status | Observação |
|--------|----------|--------|------------|
| **Stack open source** | React, NestJS, PostGIS, Docker | ✅ Implementado | 100% gratuito |
| **Autenticação JWT** | Login + perfis | ✅ Implementado | 5 perfis no schema |
| **Refresh Token** | Sim | ✅ Backend | Frontend ainda não renova automaticamente |
| **Dashboard** | Indicadores + gráficos | 🟡 Parcial | Cards + cobertura; falta gráficos e mapa mini |
| **Cadastro Municípios** | CRUD completo | 🟡 Parcial | Schema + seed; falta UI admin |
| **Cadastro UBS** | CRUD | 🟡 Schema only | Tabela pronta; falta API/UI |
| **Cadastro Bairros** | CRUD | 🟡 Schema only | Tabela pronta; falta API/UI |
| **Cadastro ACS** | CRUD + foto | 🟡 Schema only | Tabela pronta; falta API/UI |
| **Cadastro Microáreas** | CRUD | 🟡 Parcial | API create/update; falta UI |
| **Mapa fullscreen** | Layout limpo | ✅ Implementado | Toolbar flutuante |
| **Camadas** | Mapa, Satélite, Relevo, Híbrido | ✅ Implementado | OSM, Esri, OpenTopoMap |
| **Busca de ruas** | Autocomplete | ✅ Implementado | Bairro/UBS/ACS: Fase 2 |
| **Importação OSM** | Overpass API | ✅ Implementado | Ruas como LineString |
| **Vincular rua → microárea** | Com cor automática | ✅ Implementado | |
| **Regra 1 rua = 1 microárea** | Com diálogo transferência | ✅ Implementado | |
| **Modo Pincel** | Pintar Microárea | ✅ Implementado | |
| **Seleção múltipla** | Várias ruas no mapa | 🟡 Parcial | Store pronta; UI em progresso |
| **Polígono automático** | PostGIS convex hull | 🟡 Parcial | Backend + toggle; camada no mapa |
| **Info da rua** | Painel lateral | ✅ Implementado | StreetPanel |
| **Sugestão IA (proximidade)** | PostGIS ST_Distance | ✅ Backend | Endpoint `/streets/:id/suggest-microarea` |
| **Audit log** | Quem/quando/antes/depois | ✅ Backend | UI dashboard em progresso |
| **Swagger** | Documentação API | ✅ Implementado | `/docs` |
| **Docker produção** | Compose + Nginx | ✅ Implementado | |
| **Modo claro/escuro** | Sim | ✅ Implementado | Zustand + MUI theme |
| **Importação GeoJSON/KML/SHP** | Fase 2 | ⏳ Pendente | |
| **Exportação PDF/PNG/GeoJSON** | Fase 2–3 | ⏳ Pendente | |
| **PDF oficial A4/A3** | Logo, legenda, QR | ⏳ Fase 3 | |
| **Mapa de calor / estatísticas** | Fase 2 | ⏳ Pendente | |
| **Integrações e-SUS/CNES/IBGE** | Fase 4 | ⏳ Arquitetura preparada | |
| **App mobile / offline** | Fase 5 | ⏳ Pendente | |

**Legenda:** ✅ Concluído · 🟡 Parcial · ⏳ Planejado

---

## Análise crítica da proposta

### Pontos fortes da proposta

1. **Foco GIS real** — Usar OSM como malha viária evita desenho manual impreciso.
2. **Arquitetura multi-município** — `Municipality` como tenant lógico escala bem.
3. **PostGIS nativo** — Geometrias + consultas espaciais são a escolha correta.
4. **Audit log** — Essencial para ambiente público e LGPD.
5. **100% open source** — Viável sem custos de licenciamento.

### Ajustes recomendados (sem alterar o objetivo)

| Item original | Recomendação | Motivo |
|---------------|--------------|--------|
| IA generativa | **Proximidade geográfica PostGIS** (já implementada) | Mais previsível, auditável e sem custo de API |
| PDF com QR Code na Fase 1 | **Mover para Fase 3** | Requer layout complexo e biblioteca de renderização |
| Cadastro Famílias/Imóveis na Fase 1 | **Fase 2–3** | Depende de integração e-SUS ou carga manual |
| Mapa de calor na Fase 1 | **Fase 2** | Requer volume de dados e biblioteca de visualização |
| OpenFreeMap | **Opcional** | OSM + Esri já atendem; adicionar se necessário redundância |

### Riscos identificados

1. **Cobertura OSM em municípios pequenos** — Nem todas as ruas podem existir no OSM; permitir cadastro manual/GeoJSON.
2. **Performance com milhares de ruas** — Usar paginação, simplificação de geometria e clustering no zoom baixo.
3. **Overpass API** — Rate limit; implementar fila e cache local (já previsto na arquitetura).
4. **LGPD** — CPF de ACS exige controle de acesso rigoroso por perfil.

---

## Roadmap recomendado

### Fase 1 — MVP (atual) ✅ ~75%

- [x] Auth, mapa, OSM, microáreas, pintura, conflitos
- [x] PostGIS, envelopes, audit backend
- [ ] Polígonos no mapa, seleção múltipla, histórico no dashboard
- [ ] Documentação + GitHub

### Fase 2 — Cadastros e dados (4–6 semanas)

- CRUD UBS, ACS, Bairros, Microáreas (UI)
- Importação GeoJSON, KML, CSV
- Exportação GeoJSON, PNG
- Gráficos no dashboard (Recharts)
- Busca unificada (rua, bairro, UBS, ACS)

### Fase 3 — Relatórios oficiais (3–4 semanas)

- PDF A4/A3 com logos, legenda, escala, rosa dos ventos
- QR Code para versão digital
- Mapa de calor por densidade de famílias

### Fase 4 — Integrações (contínuo)

- e-SUS APS, CNES, IBGE
- Sincronização de famílias e indivíduos

### Fase 5 — Mobile e offline

- PWA ou React Native
- Cache de tiles e geometrias

---

## Conclusão

A proposta é **técnicamente sólida e viável** com tecnologias gratuitas. O MVP já demonstra o diferencial principal: **organizar microáreas sobre ruas reais no mapa**. A continuidade deve priorizar cadastros administrativos, exportação PDF e integrações — nessa ordem — para entregar valor incremental à Secretaria Municipal de Saúde.
