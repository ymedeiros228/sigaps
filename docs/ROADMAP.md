# SIGAPS — Roadmap de Desenvolvimento

## Fase 1 — MVP (Jun/2026) — **Em andamento**

### Concluído

- [x] Monorepo com backend NestJS + frontend React
- [x] PostgreSQL + PostGIS + migrations
- [x] Autenticação JWT (login + refresh token backend)
- [x] Seed Passagem Franca + 5 microáreas coloridas
- [x] Importação de ruas via Overpass API
- [x] Mapa Leaflet com camadas (mapa, satélite, relevo)
- [x] Vinculação rua → microárea com cores
- [x] Modo "Pintar Microárea"
- [x] Diálogo de conflito / transferência
- [x] Polígono automático (PostGIS convex hull)
- [x] Sugestão de microárea por proximidade
- [x] Dashboard com indicadores
- [x] Audit log (backend)
- [x] Swagger `/docs`
- [x] Docker Compose + Nginx
- [x] Modo claro/escuro

### Em progresso (esta sprint)

- [x] Camada de polígonos no mapa (envelopes)
- [x] Seleção múltipla de ruas (Ctrl+clique)
- [x] Histórico de alterações no dashboard
- [x] Documentação completa + PDF
- [x] Repositório GitHub

---

## Fase 2 — Cadastros e importação (Jul–Ago/2026) — **Concluída** ✅

- [x] Módulos API: UBS, ACS, Bairros
- [x] Telas CRUD administrativas
- [x] Upload de logo do município
- [x] Importação GeoJSON
- [x] Importação KML, CSV
- [x] Exportação GeoJSON (ruas + microáreas)
- [x] Exportação PNG do mapa
- [x] Gráficos no dashboard (Recharts)
- [x] Busca unificada (rua, bairro, UBS, ACS, microárea)
- [x] Refresh token automático no frontend

---

## Fase 3 — Relatórios oficiais (Set/2026)

- [x] Geração PDF A4/A3 (mapa oficial com satélite, microáreas, legenda)
- [x] Layout: logos, legenda, escala, rosa dos ventos, QR Code
- [ ] Exportação KML, SVG, JPEG
- [ ] Mapa de calor (famílias/habitantes por rua)

---

## Fase 4 — Integrações governamentais (2026–2027)

- [ ] e-SUS APS (famílias, indivíduos)
- [ ] CNES (UBS)
- [ ] IBGE (setores censitários)
- [ ] DATASUS (indicadores)

---

## Fase 5 — Mobile e offline (2027)

- [ ] PWA ou app nativo
- [ ] GPS em tempo real para ACS
- [ ] Cache offline de tiles e geometrias

---

## Critérios de aceite por fase

| Fase | Critério |
|------|----------|
| 1 | Enfermeiro consegue importar ruas, pintar microáreas e ver cobertura no dashboard |
| 2 | Secretário cadastra UBS/ACS e importa GeoJSON de bairros |
| 3 | PDF impresso em A3 aceito pela SMS como mapa oficial |
| 4 | Famílias sincronizadas com e-SUS |
| 5 | ACS consulta microárea no celular offline |
