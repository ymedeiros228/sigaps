# SIGAPS — Deploy gratuito na web

Este guia coloca o SIGAPS online **sem custo inicial**, usando subdomínios gratuitos. Depois, se a SMS quiser domínio próprio (`.com.br` ou `.gov.br`), basta apontar o DNS — o sistema não muda.

## Arquitetura recomendada

| Serviço | Função | URL exemplo (grátis) |
|---------|--------|----------------------|
| **Supabase** | Banco PostgreSQL + PostGIS | (interno, não aparece para o usuário) |
| **Render** | API NestJS (backend) | `https://sigaps-api.onrender.com` |
| **Cloudflare Pages** | Site React (frontend) | `https://sigaps.pages.dev` |

**Custo inicial:** R$ 0  
**Domínio pago (opcional depois):** ~R$ 40/ano (`.com.br`) + DNS grátis no Cloudflare

---

## Deploy automatizado (GitHub Actions)

Cada **push na branch `master`** dispara:

1. **Migrate + seed** no Supabase (se `DATABASE_URL` estiver configurado)
2. **Site** → Cloudflare Pages (`sigaps.pages.dev`)
3. **API** → webhook do Render (redeploy)

### Configuração única (~15 min)

#### 1. Secrets no GitHub

Repositório → **Settings → Secrets and variables → Actions**:

| Secret | Onde obter |
|--------|------------|
| `DATABASE_URL` | Supabase → Database → URI (porta **6543**, pooler) |
| `VITE_API_URL` | URL do Render após criar API (ex. `https://sigaps-api.onrender.com`) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → **Edit Cloudflare Pages** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → URL ou Overview |
| `RENDER_DEPLOY_HOOK` | Render → serviço `sigaps-api` → Settings → **Deploy Hook** |

**Script interativo (Windows):**

```powershell
.\scripts\deploy-remote.ps1
```

#### 2. Render (API)

1. [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**
2. Conecte o repo `ymedeiros228/sigaps`
3. Preencha `DATABASE_URL` e `FRONTEND_URL` (temporário: `https://sigaps.pages.dev`)
4. Copie o **Deploy Hook** para o secret GitHub

#### 3. Cloudflare (site)

O workflow cria/publica o projeto **`sigaps`** automaticamente.  
Não precisa conectar Git no painel Cloudflare se usar o GitHub Action.

#### 4. Primeiro deploy

```powershell
git push origin master
```

Acompanhe: **GitHub → Actions** ou `gh run watch`

---

## Passo a passo manual (alternativa)

### 1. GitHub

1. Crie um repositório e envie o código do SIGAPS.
2. Mantenha `.env` **fora** do Git (já está no `.gitignore`).

### 2. Supabase (banco de dados)

1. Acesse [supabase.com](https://supabase.com) → **New project** (região **South America** se disponível).
2. Anote a senha do banco.
3. Em **SQL Editor**, execute:

```sql
create extension if not exists postgis;
```

4. Em **Settings → Database**, copie a **Connection string** (URI).
   - Use a porta **6543** (pooler) para o Render.
   - Substitua `[YOUR-PASSWORD]` pela senha real.

### 3. Render (backend / API)

1. Acesse [render.com](https://render.com) → **New → Blueprint** ou **Web Service**.
2. Conecte o repositório GitHub.
3. Se usar o arquivo `render.yaml` na raiz, o Render detecta automaticamente.
4. Configure as variáveis (veja `.env.production.example`):

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | URI do Supabase |
| `JWT_SECRET` | String aleatória longa (32+ caracteres) |
| `JWT_REFRESH_SECRET` | Outra string aleatória |
| `FRONTEND_URL` | URL do Cloudflare Pages (ex.: `https://sigaps.pages.dev`) |

5. Após o primeiro deploy, abra o **Shell** do serviço e rode o seed (dados iniciais):

```bash
npx prisma db seed
```

> Se o seed falhar por falta de `ts-node`, rode uma vez **no seu PC** apontando para o Supabase:
> `cd backend` → defina `DATABASE_URL` → `npx prisma db seed`

6. Anote a URL da API: `https://sigaps-api.onrender.com`

### 4. Cloudflare Pages (frontend / site)

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Selecione o repositório.
3. Configuração de build:

| Campo | Valor |
|-------|-------|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |

4. Variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `VITE_API_URL` | `https://sigaps-api.onrender.com` (sua URL do Render) |
| `VITE_DEV_AUTO_LOGIN` | `false` |

5. Deploy. A URL será algo como `https://sigaps.pages.dev`.

### 5. Ligar frontend ↔ backend

1. No **Render**, atualize `FRONTEND_URL` com a URL real do Cloudflare Pages.
2. Aguarde o redeploy automático.
3. Abra o site, faça login com o usuário do seed (`jonas@passagemfranca.ma.gov.br` / `Sigaps@2026` — **troque a senha em produção**).

---

## Trocar para domínio pago depois

1. Compre o domínio (ex.: `sigaps.passagemfranca.ma.gov.br` via governo, ou `sigaps.ma.gov.br`).
2. No **Cloudflare**, adicione o domínio e configure DNS:
   - `CNAME` `@` ou `www` → `sigaps.pages.dev` (Pages custom domain)
3. No **Render**, adicione custom domain na API (opcional): `api.seudominio.com.br`
4. Atualize `FRONTEND_URL` e `VITE_API_URL` com os novos endereços.

Nenhuma alteração de código é obrigatória — só variáveis de ambiente e DNS.

---

## Checklist pós-deploy

- [ ] Login funciona
- [ ] Mapa carrega ruas (clique em **Atualizar ruas**)
- [ ] Pintura de microárea salva
- [ ] Dashboard mostra indicadores
- [ ] PDF do mapa gera
- [ ] Senha padrão do seed foi alterada
- [ ] `VITE_DEV_AUTO_LOGIN=false` em produção

---

## Solução de problemas

| Problema | Causa provável | Solução |
|----------|----------------|---------|
| Site abre, login falha | CORS / URL errada | Conferir `FRONTEND_URL` no Render |
| API demora 1 minuto | Plano free “dorme” | Normal — ver limitações |
| Mapa sem ruas | Seed não rodou | Rodar `prisma db seed` + **Atualizar ruas** |
| Erro de banco | PostGIS ou URL | `create extension postgis` no Supabase |

---

## Referências

- Limitações para usuários finais: [LIMITACOES_PLANO_GRATUITO.md](./LIMITACOES_PLANO_GRATUITO.md)
- Variáveis de exemplo: `/.env.production.example`
- Blueprint Render: `/render.yaml`
