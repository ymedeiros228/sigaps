# Forca redeploy no Render + migrate no Supabase
# Uso: $env:RENDER_API_KEY = "rnd_..."; .\scripts\deploy-site-now.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ServiceId = "srv-d92aao6q1p3s73fh15fg"
$EnvFile = Join-Path $Root "backend\.env"

Write-Host ""
Write-Host "=== SIGAPS - Deploy completo no site ===" -ForegroundColor Cyan

# 1. Migrations Supabase (session pooler 5432)
if (Test-Path $EnvFile) {
  Write-Host ""
  Write-Host "[1/3] Aplicando migrations no Supabase..." -ForegroundColor Cyan
  Push-Location (Join-Path $Root "backend")
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { Pop-Location; exit 1 }
  Pop-Location
  Write-Host "[ok] Migrations aplicadas" -ForegroundColor Green
} else {
  Write-Host "[skip] backend\.env nao encontrado - migrations manuais" -ForegroundColor Yellow
}

# 2. GitHub secret DATABASE_URL
if (Get-Command gh -ErrorAction SilentlyContinue) {
  if (Test-Path $EnvFile) {
    $dbLine = Get-Content $EnvFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
    if ($dbLine) {
      $dbUrl = ($dbLine -split '=', 2)[1].Trim().Trim('"').Trim("'")
      if ($dbUrl -match ':6543/') { $dbUrl = $dbUrl -replace ':6543/', ':5432/' }
      $dbUrl | gh secret set DATABASE_URL --repo ymedeiros228/sigaps 2>$null
      if ($LASTEXITCODE -eq 0) {
        Write-Host "[ok] GitHub secret DATABASE_URL configurado" -ForegroundColor Green
      }
    }
  }
}

# 2b. Corrigir DATABASE_URL no Render
if ($env:RENDER_API_KEY) {
  Write-Host ""
  Write-Host "[2b] Sincronizando DATABASE_URL no Render..." -ForegroundColor Cyan
  & (Join-Path $Root "scripts\render-fix-database-url.ps1")
}

# 3. Redeploy Render
$apiKey = $env:RENDER_API_KEY
if (-not $apiKey) {
  Write-Host ""
  Write-Host "[3/3] RENDER_API_KEY nao definida - abra Render > Manual Deploy" -ForegroundColor Yellow
  Write-Host "  https://dashboard.render.com/web/$ServiceId" -ForegroundColor White
  exit 0
}

Write-Host ""
Write-Host "[3/3] Disparando redeploy no Render..." -ForegroundColor Cyan
$headers = @{ Authorization = "Bearer $apiKey"; Accept = "application/json"; "Content-Type" = "application/json" }
try {
  $deploy = Invoke-RestMethod -Method Post -Uri "https://api.render.com/v1/services/$ServiceId/deploys" -Headers $headers -Body "{}"
  Write-Host "[ok] Deploy iniciado: $($deploy.id)" -ForegroundColor Green
  Write-Host "Aguarde 5-8 min e acesse: https://sigaps-api.onrender.com/mapa" -ForegroundColor White
  Write-Host "Use Ctrl+Shift+R para limpar cache do navegador." -ForegroundColor DarkGray
} catch {
  Write-Host "Erro Render: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
