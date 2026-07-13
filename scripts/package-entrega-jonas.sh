#!/usr/bin/env bash
# Gera ZIP do código-fonte para entrega ao Jonas.
# Só executa se existir entrega/FINALIZADO.txt (entrega de software concluída).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MARKER="$ROOT/entrega/FINALIZADO.txt"
OUT_DIR="$ROOT/downloads"
PUBLIC_DIR="$ROOT/frontend/public/downloads"
STAGING="$ROOT/entrega/.staging-jonas-legado"
DATE_TAG="$(date -u +%Y-%m-%d)"
COMMIT="$(git -C "$ROOT" rev-parse HEAD 2>/dev/null || echo unknown)"
ZIP_NAME="sigaps-legado-passagem-franca-${DATE_TAG}.zip"
ZIP_PATH="$OUT_DIR/$ZIP_NAME"
LATEST_LINK="$OUT_DIR/sigaps-legado-passagem-franca.zip"

if [[ ! -f "$MARKER" ]]; then
  echo "ERRO: entrega/FINALIZADO.txt não encontrado."
  echo "Só gere o pacote quando a entrega de software estiver finalizada."
  exit 1
fi

echo "==> Empacotando SIGAPS legado (commit ${COMMIT:0:7})"

rm -rf "$STAGING"
mkdir -p "$STAGING/sigaps-legado/entrega" "$OUT_DIR" "$PUBLIC_DIR"

cp "$ROOT/entrega/jonas-legado/LEIA-ME.md" "$STAGING/sigaps-legado/LEIA-ME.md"
cp "$MARKER" "$STAGING/sigaps-legado/entrega/FINALIZADO.txt"

cat > "$STAGING/sigaps-legado/ENTREGA-VERSAO.txt" <<EOF
SIGAPS — Pacote legado Passagem Franca/MA
Gerado em: ${DATE_TAG} (UTC)
Commit Git: ${COMMIT}
Produção: https://sigaps-api.onrender.com/mapa
Health: https://sigaps-api.onrender.com/health
Download: https://sigaps-api.onrender.com/entrega/sigaps-legado-passagem-franca.zip
EOF

copy_tree() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  tar -C "$src" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='coverage' \
    --exclude='uploads' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='public/downloads' \
    -cf - . | tar -C "$dest" -xf -
}

for item in backend frontend docs scripts; do
  if [[ -d "$ROOT/$item" ]]; then
    mkdir -p "$STAGING/sigaps-legado/$item"
    copy_tree "$ROOT/$item" "$STAGING/sigaps-legado/$item"
  fi
done

for item in docker-compose.yml render.yaml README.md LICENSE .env.production.example; do
  if [[ -f "$ROOT/$item" ]]; then
    cp "$ROOT/$item" "$STAGING/sigaps-legado/"
  fi
done

rm -f "$ZIP_PATH" "$LATEST_LINK"
(cd "$STAGING" && zip -rq "$ZIP_PATH" sigaps-legado)
cp "$ZIP_PATH" "$LATEST_LINK"
cp "$ZIP_PATH" "$PUBLIC_DIR/$ZIP_NAME"
cp "$ZIP_PATH" "$PUBLIC_DIR/sigaps-legado-passagem-franca.zip"

if [[ ! -f "$PUBLIC_DIR/index.html" ]]; then
  cat > "$PUBLIC_DIR/index.html" <<'HTML'
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SIGAPS — Download entrega Jonas</title>
  </head>
  <body>
    <h1>Pacote legado — Passagem Franca/MA</h1>
    <p><a href="./sigaps-legado-passagem-franca.zip">Baixar ZIP</a></p>
  </body>
</html>
HTML
fi

BYTES=$(wc -c < "$ZIP_PATH" | tr -d ' ')
MB=$(awk "BEGIN {printf \"%.1f\", $BYTES/1048576}")

rm -rf "$STAGING"

cat > "$OUT_DIR/README.md" <<EOF
# Downloads — SIGAPS Passagem Franca/MA

Pacote de **código-fonte legado** para Jonas Almeida Medeiros.

| Arquivo | Descrição |
|---------|-----------|
| [sigaps-legado-passagem-franca.zip](sigaps-legado-passagem-franca.zip) | Última versão empacotada |
| \`${ZIP_NAME}\` | Build datado de ${DATE_TAG} |

**Download direto (ZIP):** https://sigaps-api.onrender.com/entrega/sigaps-legado-passagem-franca.zip

**Página de download:** https://sigaps-api.onrender.com/downloads/

Gerado em ${DATE_TAG} · commit \`${COMMIT:0:7}\` · ~${MB} MB

Regenerar: \`bash scripts/package-entrega-jonas.sh\`
EOF

echo ""
echo "OK: $ZIP_PATH (${MB} MB)"
echo "URL: https://sigaps-api.onrender.com/entrega/sigaps-legado-passagem-franca.zip"
