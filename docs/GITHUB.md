# Publicar SIGAPS no GitHub

## Pré-requisitos

1. Conta no [GitHub](https://github.com)
2. [Git](https://git-scm.com/) instalado
3. (Opcional) [GitHub CLI](https://cli.github.com/) — `winget install GitHub.cli`

## Passo a passo

### 1. Criar repositório no GitHub

Acesse https://github.com/new e crie um repositório:

- **Nome:** `sigaps`
- **Visibilidade:** Public ou Private
- **Não** marque "Add README" (já existe localmente)

### 2. Configurar git (primeira vez)

```powershell
git config --global user.name "Seu Nome"
git config --global user.email "seu@email.com"
```

### 3. Inicializar e enviar (já feito localmente se você rodou os comandos do agente)

```powershell
cd C:\Users\Edina\Projects\sigaps
git init
git add .
git commit -m "feat: SIGAPS MVP — sistema GIS de microáreas da APS"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/sigaps.git
git push -u origin main
```

Substitua `SEU_USUARIO` pelo seu username do GitHub.

### 4. Com GitHub CLI (alternativa)

```powershell
gh auth login
gh repo create sigaps --public --source=. --remote=origin --push
```

## Autenticação

Se `git push` pedir senha, use um **Personal Access Token** (PAT):

1. GitHub → Settings → Developer settings → Personal access tokens
2. Gere token com escopo `repo`
3. Use o token como senha no push

## Conteúdo do repositório

- Código backend + frontend
- Documentação em `docs/`
- PDF em `docs/SIGAPS_Documentacao_Completa.pdf`
- Docker Compose para deploy
- Licença MIT
