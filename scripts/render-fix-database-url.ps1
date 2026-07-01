# Configura DATABASE_URL no Render via API (sem browser — evita travamento do Cursor)
#
# 1. Crie API key: https://dashboard.render.com/u/settings#api-keys
# 2. Rode:
#    $env:RENDER_API_KEY = "rnd_..."
#    .\scripts\render-fix-database-url.ps1
#
# Ou cole a key quando o script pedir.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$EnvFile = Join-Path $Root "backend\.env"
$ServiceId = "srv-d92aao6q1p3s73fh15fg"
$RenderEnvUrl = "https://dashboard.render.com/web/$ServiceId/env"

if (-not (Test-Path $EnvFile)) {
  Write-Host "backend\.env nao encontrado." -ForegroundColor Red
  exit 1
}

$line = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
if (-not $line) {
  Write-Host "DATABASE_URL nao definido em backend\.env" -ForegroundColor Red
  exit 1
}

$dbUrl = ($line -split '=', 2)[1].Trim().Trim('"').Trim("'")
$dbUrl = $dbUrl -replace ':5432/', ':6543/'
if ($dbUrl -notmatch '^postgresql://') {
  Write-Host "URL invalida em backend\.env" -ForegroundColor Red
  exit 1
}

$apiKey = $env:RENDER_API_KEY
if (-not $apiKey) {
  Write-Host ""
  Write-Host "API key do Render (Account Settings -> API Keys):" -ForegroundColor Cyan
  Write-Host "https://dashboard.render.com/u/settings#api-keys" -ForegroundColor DarkGray
  $secure = Read-Host "RENDER_API_KEY" -AsSecureString
  $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
}

if (-not $apiKey) {
  Write-Host "API key obrigatoria." -ForegroundColor Red
  exit 1
}

$headers = @{
  Authorization = "Bearer $apiKey"
  Accept        = "application/json"
  "Content-Type" = "application/json"
}

Write-Host ""
Write-Host "Atualizando DATABASE_URL no sigaps-api..." -ForegroundColor Cyan

$uri = "https://api.render.com/v1/services/$ServiceId/env-vars/DATABASE_URL"
$body = @{ value = $dbUrl } | ConvertTo-Json

try {
  Invoke-RestMethod -Method Put -Uri $uri -Headers $headers -Body $body | Out-Null
  Write-Host "[ok] DATABASE_URL configurado (pooler 6543)" -ForegroundColor Green
}
catch {
  Write-Host "Erro na API Render: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message -ForegroundColor DarkRed }
  Write-Host ""
  Write-Host "Fallback manual (Chrome/Edge, NAO use o browser do Cursor):" -ForegroundColor Yellow
  Set-Clipboard -Value $dbUrl
  Write-Host "  URL copiada. Abra: $RenderEnvUrl"
  Write-Host "  Edit -> DATABASE_URL -> Ctrl+V -> Save, rebuild, and deploy"
  exit 1
}

Write-Host "Disparando redeploy..." -ForegroundColor Cyan
$deployUri = "https://api.render.com/v1/services/$ServiceId/deploys"
try {
  Invoke-RestMethod -Method Post -Uri $deployUri -Headers $headers -Body "{}" | Out-Null
  Write-Host "[ok] Deploy iniciado" -ForegroundColor Green
}
catch {
  Write-Host "[aviso] Variavel salva, mas deploy automatico falhou." -ForegroundColor Yellow
  Write-Host "  No Render: Manual Deploy" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Aguarde ~5-10 min e teste: https://sigaps-api.onrender.com/docs" -ForegroundColor White
