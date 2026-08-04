# Roteiro de entrevista — SIGAPS (10 perguntas)

Use para defender o projeto oralmente. Respostas curtas; abra o código só se pedirem.

## 1. O que é o SIGAPS e para quem?

Sistema web GIS para gestão territorial das **microáreas da APS** (ACS, UBS, cobertura). Cliente: planejamento da APS em **Passagem Franca/MA**, com desenho multi-município.

## 2. Por que não um CRUD simples?

Domínio espacial (ruas/microáreas), papéis de acesso, LGPD (CPF), export oficial e operação em prefeitura — PostGIS + roles resolvem o que planilha não resolve.

## 3. Por que NestJS + React + Prisma + PostGIS?

- Nest: modules, guards JWT, Swagger
- React/Vite: SPA mapa + PWA
- Prisma: migrations e typings
- PostGIS: geometria e índices espaciais, não só GeoJSON em JSON

## 4. Como isola dado por município?

JWT carrega contexto; queries/guards restringem por municipalityId. Admin multi-município troca contexto; usuário comum fica no município atribuído.

## 5. Como funciona a pintura de microáreas?

Import de ruas (Overpass/OSM) → seleção de microárea → clique/modo pincel → API grava vínculo trecho/rua → mapa e indicadores atualizam.

## 6. O que você fez para segurança/LGPD?

Auth JWT + refresh, roles, rate limit, CPF mascarado por perfil, SQL parametrizado, secrets fora do repo, SECURITY.md para disclosure.

## 7. Como roda e como publica?

Local: Docker Postgres + backend + frontend (README). Produção: Render/Supabase/Cloudflare (docs de deploy). Free tier dorme; keep-alive em /health.

## 8. O que os testes cobrem?

Jest no backend (incl. health). CI: unit + build front + Playwright smoke (login + nav). Suite de pintura no mapa roda localmente (seed/OSM).

## 9. Onde a IA entrou e o que é seu?

IA como copiloto de código/docs. Domínio APS, priorização, validação com cliente e responsabilidade da entrega são minhas. Commits com minha identidade.

## 10. Próxima evolução técnica?

Offline PWA mais forte, audit log fino, filas de import, observabilidade e testes de pintura estáveis no CI.

Demo: https://sigaps-api.onrender.com  
Repo: https://github.com/ymedeiros228/sigaps
