# SIGAPS — Referência da API REST

**Base URL:** `http://localhost:3000`  
**Swagger interativo:** `http://localhost:3000/docs`  
**Autenticação:** Bearer JWT (header `Authorization: Bearer <token>`)

---

## Autenticação

### POST `/auth/login`

Público. Retorna access e refresh token.

```json
{
  "email": "jonas@passagemfranca.ma.gov.br",
  "password": "Sigaps@2026"
}
```

**Resposta 200:**

```json
{
  "user": { "id": "...", "name": "...", "email": "...", "role": "ENFERMEIRO", "municipalityId": "..." },
  "accessToken": "...",
  "refreshToken": "..."
}
```

### POST `/auth/refresh`

Público. Renova tokens.

```json
{ "refreshToken": "..." }
```

---

## Municípios

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| GET | `/municipalities` | Listar | Todos autenticados |
| GET | `/municipalities/:id` | Detalhe | Todos autenticados |
| POST | `/municipalities` | Criar | ADMINISTRADOR |
| PATCH | `/municipalities/:id` | Atualizar | ADMINISTRADOR, SECRETARIO_SAUDE |

---

## Microáreas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/microareas/municipality/:municipalityId` | Listar por município |
| GET | `/microareas/:id` | Detalhe com ACS e ruas |
| GET | `/microareas/:id/envelope` | Polígono GeoJSON (convex hull) |
| POST | `/microareas` | Criar |
| PATCH | `/microareas/:id` | Atualizar |

**Criar microárea:**

```json
{
  "number": 6,
  "name": "Microárea 06",
  "color": "#009688",
  "municipalityId": "...",
  "description": "Nova microárea"
}
```

---

## Ruas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/streets/municipality/:municipalityId` | Listar (paginado) |
| GET | `/streets/:id` | Detalhe com ACS e bairro |
| POST | `/streets/assign` | Vincular ruas à microárea |
| GET | `/streets/:id/suggest-microarea` | Sugestão por proximidade |

**Query params (listagem):** `search`, `microareaId`, `page`, `limit` (máx. 2000)

**Assign:**

```json
{
  "streetIds": ["uuid-1", "uuid-2"],
  "microareaId": "uuid-microarea",
  "forceTransfer": false
}
```

**Conflito 409:**

```json
{
  "message": "A Rua São Francisco já pertence à Microárea 03. Deseja transferi-la para a Microárea 01?",
  "code": "STREET_ALREADY_ASSIGNED",
  "conflicts": [...]
}
```

---

## OSM

| Método | Rota | Descrição | Roles |
|--------|------|-----------|-------|
| POST | `/osm/import/:municipalityId` | Importar ruas Overpass | ENFERMEIRO+ |

---

## Dashboard

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/dashboard/:municipalityId` | Indicadores + histórico |

**Resposta:**

```json
{
  "ubs": 0,
  "acs": 0,
  "microareas": 5,
  "streets": 1200,
  "families": 0,
  "inhabitants": 0,
  "coverage": 45,
  "assignedStreets": 540,
  "microareasChart": [...],
  "recentChanges": [...]
}
```

---

## Audit Log

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/audit/municipality/:municipalityId` | Histórico recente |

---

## Perfis e permissões

| Role | Descrição |
|------|-----------|
| `ADMINISTRADOR` | Acesso total |
| `SECRETARIO_SAUDE` | Gestão municipal e cadastros |
| `COORDENADOR_APS` | Gestão de microáreas e equipes |
| `ENFERMEIRO` | Mapa, assign, importação OSM |
| `ACS` | Consulta (leitura) |

---

## Códigos HTTP

| Código | Situação |
|--------|----------|
| 200 | Sucesso |
| 201 | Criado |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito (rua já em outra microárea) |
| 422 | Validação |
