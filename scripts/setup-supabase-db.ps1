# Cria tabelas + dados iniciais (Passagem Franca) no Supabase
# Rode no PowerShell: .\scripts\setup-supabase-db.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root "backend\.env"

if (-not (Test-Path $EnvFile)) {
  Write-Host "Arquivo backend\.env nao encontrado." -ForegroundColor Red
  Write-Host "Crie com DATABASE_URL=postgresql://..." -ForegroundColor Yellow
  exit 1
}

Set-Location (Join-Path $Root "backend")

Write-Host "Rodando migrations..." -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Rodando seed (usuario Jonas, microareas, ruas)..." -ForegroundColor Cyan
npx prisma db seed
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nBanco pronto!" -ForegroundColor Green
Write-Host "Login: jonas@passagemfranca.ma.gov.br / Sigaps@2026" -ForegroundColor White
