# SIGAPS — prepara deploy remoto (Supabase + secrets GitHub)
# Uso: .\scripts\deploy-remote.ps1
# Requer: GitHub CLI (gh) autenticado — https://cli.github.com

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "`n=== SIGAPS — Configuracao de deploy automatizado ===" -ForegroundColor Cyan

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host "Instale o GitHub CLI: winget install GitHub.cli" -ForegroundColor Yellow
  Write-Host "Depois: gh auth login" -ForegroundColor Yellow
  exit 1
}

$repo = gh repo view --json nameWithOwner -q .nameWithOwner 2>$null
if (-not $repo) {
  Write-Host "Repositorio GitHub nao detectado. Rode: gh repo set-default" -ForegroundColor Red
  exit 1
}
Write-Host "Repositorio: $repo" -ForegroundColor Green

function Set-GhSecretIfProvided($name, $prompt, $secret) {
  if ($secret) {
    $secret | gh secret set $name
    Write-Host "  [ok] $name" -ForegroundColor Green
    return $true
  }
  $val = Read-Host $prompt
  if ($val) {
    $val | gh secret set $name
    Write-Host "  [ok] $name" -ForegroundColor Green
    return $true
  }
  Write-Host "  [skip] $name (nao informado)" -ForegroundColor DarkYellow
  return $false
}

Write-Host "`n--- Secrets do GitHub Actions ---" -ForegroundColor Cyan
Write-Host "Obtenha DATABASE_URL no Supabase: Settings -> Database -> URI (porta 6543 pooler)`n"

Set-GhSecretIfProvided "DATABASE_URL" "DATABASE_URL (Supabase):" $env:DATABASE_URL
Set-GhSecretIfProvided "VITE_API_URL" "VITE_API_URL (ex: https://sigaps-api.onrender.com):" $env:VITE_API_URL
Set-GhSecretIfProvided "CLOUDFLARE_API_TOKEN" "CLOUDFLARE_API_TOKEN:" $env:CLOUDFLARE_API_TOKEN
Set-GhSecretIfProvided "CLOUDFLARE_ACCOUNT_ID" "CLOUDFLARE_ACCOUNT_ID:" $env:CLOUDFLARE_ACCOUNT_ID
Set-GhSecretIfProvided "RENDER_DEPLOY_HOOK" "RENDER_DEPLOY_HOOK (Render -> Settings -> Deploy Hook):" $env:RENDER_DEPLOY_HOOK

Write-Host "`n--- Proximos passos manuais (uma vez) ---" -ForegroundColor Cyan
Write-Host @"
1. Supabase: SQL Editor -> CREATE EXTENSION IF NOT EXISTS postgis;
   (ou deixe o GitHub Action rodar migrate)

2. Render: https://dashboard.render.com
   - New -> Blueprint -> repo $repo
   - Preencha DATABASE_URL e FRONTEND_URL (depois do Cloudflare)
   - Settings -> Deploy Hook -> copie URL -> rode este script de novo

3. Cloudflare: https://dash.cloudflare.com
   - My Profile -> API Tokens -> Create -> Edit Cloudflare Pages
   - Account ID na URL do dashboard

4. Push para master dispara deploy automatico:
   git push origin master

5. Apos primeiro deploy, atualize no Render:
   FRONTEND_URL = URL do Cloudflare Pages (ex: https://sigaps.pages.dev)

Documentacao: docs/DEPLOY_GRATUITO.md
"@ -ForegroundColor White

Write-Host "`nDisparar deploy agora? (s/N): " -NoNewline -ForegroundColor Yellow
$go = Read-Host
if ($go -eq 's' -or $go -eq 'S') {
  gh workflow run deploy.yml
  Write-Host "Workflow deploy.yml disparado. Acompanhe: gh run watch" -ForegroundColor Green
}
