# Publicar no GitHub — ymedeiros228

Repositório configurado: **https://github.com/ymedeiros228/sigaps**

## Status local

- Git inicializado em `C:\Users\Edina\Projects\sigaps`
- Commit: `873b804` — SIGAPS MVP com documentação, PDF e mapa GIS
- Remote `origin` → `https://github.com/ymedeiros228/sigaps.git`

## Passo 1 — Criar o repositório no GitHub

1. Acesse: https://github.com/new?name=sigaps
2. Confirme o nome **sigaps**
3. Escolha **Public** ou **Private**
4. **Não** marque "Add a README" (já existe no projeto)
5. Clique em **Create repository**

## Passo 2 — Autenticar (uma vez)

No PowerShell:

```powershell
gh auth login
```

Escolha: GitHub.com → HTTPS → Login with a web browser → autorize.

*(GitHub CLI já instalado no seu PC.)*

## Passo 3 — Enviar o código

```powershell
cd C:\Users\Edina\Projects\sigaps
git push -u origin master
```

Se preferir branch `main`:

```powershell
git branch -M main
git push -u origin main
```

## Alternativa sem `gh`

Se `git push` pedir credenciais, use um **Personal Access Token**:

1. GitHub → Settings → Developer settings → Personal access tokens → Generate
2. Escopo: `repo`
3. No push, username = `ymedeiros228`, password = **o token**

---

Após o push, o projeto estará em: **https://github.com/ymedeiros228/sigaps**
