# Configura o secret RENDER_DEPLOY_HOOK no GitHub (deploy automático da API/site)
# Uso: .\scripts\configurar-render-hook.ps1
#      .\scripts\configurar-render-hook.ps1 -HookUrl "https://api.render.com/deploy/srv-...?key=..."

param(
  [string]$HookUrl = $env:RENDER_DEPLOY_HOOK
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "Instale o GitHub CLI: winget install GitHub.cli" -ForegroundColor Yellow
  Write-Host "Depois: gh auth login" -ForegroundColor Yellow
  exit 1
}

$repo = gh repo view --json nameWithOwner -q .nameWithOwner 2>$null
if (-not $repo) {
  Write-Host "Repositorio GitHub nao detectado." -ForegroundColor Red
  exit 1
}

Write-Host "`n=== Configurar deploy automatico no Render ===" -ForegroundColor Cyan
Write-Host "Repositorio: $repo`n"

if (-not $HookUrl) {
  Write-Host @"
1. Abra https://dashboard.render.com
2. Clique no servico sigaps-api (Web Service)
3. Menu Settings -> Deploy Hook
4. Clique em Create Deploy Hook (ou copie a URL existente)
5. Cole a URL abaixo (comeca com https://api.render.com/deploy/...)
"@ -ForegroundColor White
  $HookUrl = Read-Host "Cole a URL do Deploy Hook"
}

if ($HookUrl -notmatch '^https://api\.render\.com/deploy/') {
  Write-Host "URL invalida. Deve comecar com https://api.render.com/deploy/" -ForegroundColor Red
  exit 1
}

$HookUrl | gh secret set RENDER_DEPLOY_HOOK
Write-Host "[ok] RENDER_DEPLOY_HOOK salvo no GitHub" -ForegroundColor Green

# URL da API (usada pelo workflow para confirmar deploy)
$apiUrl = Read-Host "URL da API (Enter = https://sigaps-api.onrender.com)"
if (-not $apiUrl) { $apiUrl = "https://sigaps-api.onrender.com" }
$apiUrl | gh secret set VITE_API_URL
Write-Host "[ok] VITE_API_URL = $apiUrl" -ForegroundColor Green

Write-Host "`nDisparar deploy agora? (S/n): " -NoNewline -ForegroundColor Yellow
$go = Read-Host
if ($go -ne 'n' -and $go -ne 'N') {
  gh workflow run deploy.yml
  Write-Host "Deploy disparado. Acompanhe: gh run watch" -ForegroundColor Green
}

Write-Host @"

Pronto! A partir de agora, cada push em master:
  1. Roda migracoes no Supabase
  2. Dispara redeploy no Render (site + API na mesma URL)
  3. Confirma se /health reportou o commit novo

"@ -ForegroundColor Cyan
