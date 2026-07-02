# Configurar deploy automático (push → site no ar)

Cada `git push origin master` deve:

1. Rodar migrações no Supabase
2. Disparar redeploy no Render (`sigaps-api.onrender.com` — API + site juntos)
3. Confirmar que `/health` reportou o commit novo

Hoje só funciona se o secret **`RENDER_DEPLOY_HOOK`** estiver no GitHub.

---

## Passo 1 — Copiar o Deploy Hook no Render

1. Abra [dashboard.render.com](https://dashboard.render.com)
2. Clique no serviço **sigaps-api** (Web Service)
3. Menu **Settings** → role até **Deploy Hook**
4. Clique em **Create Deploy Hook** (ou copie a URL se já existir)
5. A URL tem este formato:
   ```
   https://api.render.com/deploy/srv-XXXXXXXX?key=YYYYYYYY
   ```

**Opcional (recomendado):** em **Settings → Build & Deploy**, confira se **Auto-Deploy** está **Yes** e a branch é **master**. Isso faz o Render redeployar também em push direto no Git.

---

## Passo 2 — Salvar no GitHub (escolha um método)

### Método A — Script no Windows (mais fácil)

No PowerShell, na pasta do projeto:

```powershell
.\scripts\configurar-render-hook.ps1
```

Cole a URL do Deploy Hook quando pedir. O script também configura `VITE_API_URL` e pode disparar o deploy na hora.

### Método B — Linha de comando

```powershell
# Cole sua URL real no lugar de ...
"https://api.render.com/deploy/srv-...?key=..." | gh secret set RENDER_DEPLOY_HOOK
"https://sigaps-api.onrender.com" | gh secret set VITE_API_URL
```

### Método C — Pelo site do GitHub

1. Repositório → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
3. Nome: `RENDER_DEPLOY_HOOK` | Valor: URL copiada do Render
4. Repita para `VITE_API_URL` = `https://sigaps-api.onrender.com`

---

## Passo 3 — Conferir secrets

```powershell
gh secret list
```

Deve aparecer pelo menos:

| Secret | Obrigatório |
|--------|-------------|
| `DATABASE_URL` | Sim (migrações) |
| `RENDER_DEPLOY_HOOK` | Sim (Render atualizar) |
| `VITE_API_URL` | Sim (confirmar deploy) |
| `CLOUDFLARE_*` | Não (só se usar Cloudflare Pages separado) |

---

## Passo 4 — Testar

```powershell
gh workflow run deploy.yml
gh run watch
```

Ou faça um push:

```powershell
git push origin master
```

Quando terminar, abra:

```
https://sigaps-api.onrender.com/health
```

O campo `commit` deve ser o hash do último commit no GitHub (não mais `b9c652c`).

---

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| Action falha: `RENDER_DEPLOY_HOOK nao configurado` | Rode o Passo 2 |
| `/health` continua com commit antigo | Veja **Logs** do serviço no Render (build falhou?) |
| Site carrega mas Cadastros trava | `Ctrl+F5` após deploy; confira se `commit` no `/health` mudou |
| Migração falha no Action | Veja job **Banco (Supabase)** no GitHub Actions |

---

## Resumo

Sem `RENDER_DEPLOY_HOOK`, o código sobe no GitHub mas **o Render não atualiza** — por isso parecia que “nada funcionava”. Configurando uma vez, todo push passa a publicar na aplicação web.
