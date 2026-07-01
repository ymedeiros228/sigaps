# Configura PostgreSQL local para o SIGAPS (Windows)
$ErrorActionPreference = "Stop"

$pgVersions = @(18, 17, 16, 15)
$psql = $null
foreach ($v in $pgVersions) {
    $candidate = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
    if (Test-Path $candidate) { $psql = $candidate; break }
}

if (-not $psql) {
    Write-Host "PostgreSQL nao encontrado. Instalando PostgreSQL 17..."
    winget install -e --id PostgreSQL.PostgreSQL.17 --accept-package-agreements --accept-source-agreements
    foreach ($v in $pgVersions) {
        $candidate = "C:\Program Files\PostgreSQL\$v\bin\psql.exe"
        if (Test-Path $candidate) { $psql = $candidate; break }
    }
}

if (-not $psql) {
    Write-Error "PostgreSQL nao instalado. Instale manualmente: https://www.postgresql.org/download/windows/"
}

$pgBin = Split-Path $psql
$env:Path = "$pgBin;$env:Path"

Write-Host "Usando: $psql"

# Tenta conectar como postgres (instalacao padrao Windows)
$env:PGPASSWORD = "postgres"
$test = & psql -U postgres -h localhost -p 5432 -d postgres -tAc "SELECT 1" 2>$null
if (-not $test) {
    Write-Host ""
    Write-Host "Nao foi possivel conectar com senha 'postgres'."
    Write-Host "Defina a senha do usuario postgres e rode:"
    Write-Host '  $env:PGPASSWORD="SUA_SENHA"; .\scripts\setup-db.ps1'
    exit 1
}

& psql -U postgres -h localhost -d postgres -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sigaps') THEN CREATE USER sigaps WITH PASSWORD 'sigaps_secret' CREATEDB; END IF; END `$`$;"
& psql -U postgres -h localhost -d postgres -c "SELECT 1 FROM pg_database WHERE datname = 'sigaps'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    & psql -U postgres -h localhost -d postgres -c "CREATE DATABASE sigaps OWNER sigaps;"
} else {
    $exists = & psql -U postgres -h localhost -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = 'sigaps'"
    if (-not $exists.Trim()) {
        & psql -U postgres -h localhost -d postgres -c "CREATE DATABASE sigaps OWNER sigaps;"
    }
}

Write-Host "Banco 'sigaps' pronto."
Write-Host "Agora rode: cd backend; npx prisma migrate deploy; npm run prisma:seed"
