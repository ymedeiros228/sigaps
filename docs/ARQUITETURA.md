# SIGAPS — Arquitetura Técnica

## Visão geral

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (porta 80)                      │
│              Reverse proxy + arquivos estáticos              │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
       ┌───────▼───────┐              ┌───────▼───────┐
       │   Frontend    │              │    Backend    │
       │  React + Vite │   REST/JWT   │    NestJS     │
       │  Leaflet/MUI  │◄────────────►│    Prisma     │
       └───────────────┘              └───────┬───────┘
                                              │
                                      ┌───────▼───────┐
                                      │  PostgreSQL   │
                                      │   + PostGIS   │
                                      └───────────────┘
```

## Camadas

### Frontend (`frontend/`)

| Pasta | Responsabilidade |
|-------|------------------|
| `pages/` | Telas (Login, Dashboard, Mapa) |
| `components/map/` | Leaflet, camadas, toolbar, painéis |
| `components/layout/` | Shell da aplicação, navegação |
| `services/api.ts` | Cliente HTTP (Axios) |
| `store/` | Estado global (Zustand): auth, mapa, tema |
| `theme/` | Material UI — modo claro/escuro |

### Backend (`backend/`)

Organizado em **módulos NestJS** (Clean Architecture por domínio):

| Módulo | Endpoints principais |
|--------|---------------------|
| `auth` | POST `/auth/login`, POST `/auth/refresh` |
| `municipalities` | CRUD municípios |
| `microareas` | CRUD + GET `/envelope` |
| `streets` | Listagem, assign, suggest-microarea |
| `osm` | POST `/osm/import/:id` |
| `dashboard` | GET `/dashboard/:municipalityId` |

**Cross-cutting:**

- `common/guards` — JWT + Roles
- `common/services/audit.service` — Audit log
- `prisma/` — ORM + conexão PostgreSQL

## Banco de dados espacial

### Modelo relacional (Prisma)

Entidades: `User`, `Municipality`, `Ubs`, `Neighborhood`, `Microarea`, `Acs`, `Street`, `AuditLog`.

### Geometrias PostGIS (migration SQL)

| Tabela | Coluna | Tipo | Uso |
|--------|--------|------|-----|
| `streets` | `geom` | `LineString(4326)` | Sincronizado via trigger de `geojson` |
| `microareas` | `envelope_geom` | `Polygon(4326)` | Convex hull das ruas vinculadas |

### Funções PostgreSQL

- `sync_street_geom()` — Trigger BEFORE INSERT/UPDATE: converte GeoJSON → geom, calcula comprimento.
- `update_microarea_envelope(uuid)` — Recalcula polígono envolvente após assign de ruas.

### Consultas espaciais

Sugestão de microárea por proximidade:

```sql
SELECT m.id, MIN(ST_Distance(s.geom::geography, ms.geom::geography)) AS distance
FROM microareas m
JOIN streets ms ON ms.microarea_id = m.id
CROSS JOIN streets s
WHERE s.id = :streetId
GROUP BY m.id
ORDER BY distance ASC
LIMIT 3;
```

## Segurança

| Mecanismo | Implementação |
|-----------|---------------|
| Autenticação | JWT access (15 min) + refresh (7 dias) |
| Autorização | `@Roles()` decorator + `RolesGuard` |
| Audit | Toda assign de rua registrada em `audit_logs` |
| LGPD | Perfis restritos; CPF apenas para roles autorizados |

## Integrações externas (gratuitas)

| Serviço | Uso |
|---------|-----|
| OpenStreetMap tiles | Camada base |
| Esri World Imagery | Satélite |
| OpenTopoMap | Relevo |
| Nominatim | Geocoding do município (import OSM) |
| Overpass API | Download de vias |

## Deploy

```bash
docker compose up -d --build
```

Serviços: `postgres`, `backend`, `frontend`, `nginx`.

Variáveis em `.env` (ver `.env.example`).

## Escalabilidade multi-município

Cada registro possui `municipalityId`. Novos municípios:

1. Cadastrar em `municipalities`
2. Criar usuários vinculados
3. Importar ruas OSM
4. Configurar microáreas

Nenhuma alteração de código necessária por município.
