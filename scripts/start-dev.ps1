# Inicia SIGAPS (Windows) — backend + frontend
$root = Split-Path $PSScriptRoot -Parent

if (-not (Test-Path "$root\frontend\.env")) {
    Copy-Item "$root\frontend\.env.example" "$root\frontend\.env"
}

$pgBin = "C:\Program Files\PostgreSQL\17\bin"
if (Test-Path $pgBin) { $env:Path = "$pgBin;$env:Path" }

Write-Host "=== SIGAPS ===" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3000"
Write-Host "Login:    jonas@passagemfranca.ma.gov.br / Sigaps@2026"
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\backend'; npm run start:dev"
Start-Sleep -Seconds 4
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\frontend'; npm run dev"
