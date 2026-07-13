# Onboarding — Segundo município (Pedreiras/MA)

Guia operacional para colocar **Pedreiras** em produção no SIGAPS, validando o modelo multi-tenant já usado em Passagem Franca.

## Pré-requisitos

- Acesso de **administrador** (`admin@passagemfranca.ma.gov.br` ou conta global equivalente).
- Banco de produção com seed/migração atualizada (Pedreiras já existe no `prisma/seed.ts`).
- Logo da prefeitura (PNG, fundo transparente, ~512×512 px).

## Credenciais iniciais (seed)

| Campo | Valor |
|-------|-------|
| E-mail | `admin@pedreiras.ma.gov.br` |
| Senha | `Sigaps@2026` |
| Papel | Administrador do município Pedreiras |

**Altere a senha** após o primeiro acesso em **Administração → Usuários**.

## Passo 1 — Trocar contexto no painel

1. Faça login com um administrador que enxergue mais de um município.
2. No menu lateral, use **Município ativo** e selecione **Pedreiras/MA**.
3. Confirme no diálogo — o drawer passa a exibir *Pedreiras/MA* e todos os dados (dashboard, mapa, cadastros) referem-se a esse tenant.

O município escolhido fica em `localStorage` (`sigaps_active_municipality`) para a próxima sessão.

## Passo 2 — Cadastros base

Em **Cadastros**, na ordem sugerida:

1. **Município** — conferir nome, secretaria, coordenadas centrais (-4.5647, -44.5969) e enviar logo.
2. **UBS** — a seed já cria *UBS Central Pedreiras*; ajuste endereço/telefone/CNES se necessário.
3. **Microáreas** — criar numeração e cores conforme divisão territorial da SMS.
4. **ACS** — vincular cada agente à microárea e UBS.
5. **Bairros** — cadastro manual ou importação CSV/planilha.

## Passo 3 — Ruas no mapa

1. **Cadastros → Ruas** (ou fluxo de importação OSM/GeoJSON conforme disponível no ambiente).
2. Para municípios novos sem bundle local, importar geometrias de ruas (OSM ou shapefile).
3. Abrir **Pintar Mapa** e vincular ruas às microáreas até **cobertura ≥ 80%** (meta do checklist).

## Passo 4 — Povoados e pontos de interesse

Use **Cadastros → Lugares** para povoados que o Nominatim não encontra:

- Colar coordenadas do Google Maps, ou
- Escolher ponto no mapa satélite.

## Passo 5 — Checklist e homologação (A6)

1. **Dashboard** — revisar o checklist operacional (9 itens).
2. Quando `readyForHomologation` estiver verdadeiro, **Administração → Homologação**:
   - Registrar homologação SMS (notas opcionais).
   - Baixar termo PDF para arquivo da secretaria.
3. PDFs do mapa passam a exibir carimbo de homologação.

## Passo 6 — Usuários locais

Crie em **Administração → Usuários**:

- Enfermeiro(es) da coordenação (`ENFERMEIRO` ou `COORDENADOR_APS`).
- Secretário(a) de saúde, se aplicável (`SECRETARIO_SAUDE`).
- ACS com perfil restrito à própria microárea.

Cada usuário não-admin deve ter `municipalityId` = Pedreiras.

## Validação multi-tenant

| Verificação | Esperado |
|-------------|----------|
| Trocar PF ↔ Pedreiras | Dados isolados; sem vazamento de ruas/ACS |
| API com `municipalityId` de outro tenant | 403 (guard de escopo) |
| Logout/login | Município ativo persistido (admin) |
| Health produção | `commit` atual em `/health` |

## Produção

Após merge em `master`, o Render redeploya automaticamente. Confirme:

```text
https://sigaps-api.onrender.com/health
```

Use **Ctrl+Shift+R** no navegador após o deploy.

## Suporte

- Manual completo: `docs/manual/MANUAL_ENTREGA.md`
- Roadmap: `docs/ROADMAP.md` (item *Segundo município*)
