/**
 * Importa UBS de planilha Excel/CSV para produção (ou ambiente local).
 * Uso: node scripts/import-ubs-spreadsheet.mjs [caminho.xlsx]
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'node_modules', 'xlsx'));

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = join(__dirname, '..', 'docs', 'templates', 'banco_localizacoes_coordenadas.xlsx');

const BASE = process.env.SIGAPS_URL || 'https://sigaps-api.onrender.com';
const EMAIL = process.env.SIGAPS_EMAIL || 'admin@passagemfranca.ma.gov.br';
const PASS = process.env.SIGAPS_PASS || 'Sigaps@2026';

function normHeader(value) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function pickColumn(headers, aliases) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function parseCoordNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
}

function parseRowsFromObjects(rows) {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map(normHeader);
  const originalKeys = Object.keys(rows[0]);

  const nameIdx = pickColumn(headers, ['nome', 'name', 'unidade', 'ubs', 'local']);
  const addressIdx = pickColumn(headers, ['endereco', 'address', 'logradouro', 'observacao', 'origem']);
  const latIdx = pickColumn(headers, ['latitude', 'lat']);
  const lngIdx = pickColumn(headers, ['longitude', 'lng', 'lon', 'long']);
  const coordsIdx = pickColumn(headers, ['coordenada', 'coordenadas', 'coordinates', 'coords']);

  const get = (row, idx) => (idx >= 0 ? row[originalKeys[idx]] : undefined);

  return rows
    .map((row) => {
      const name = String(nameIdx >= 0 ? get(row, nameIdx) : row[originalKeys[0]] ?? '').trim();
      if (!name) return null;

      let latitude = parseCoordNumber(latIdx >= 0 ? get(row, latIdx) : undefined);
      let longitude = parseCoordNumber(lngIdx >= 0 ? get(row, lngIdx) : undefined);

      if (latitude == null || longitude == null) {
        const pair = String(coordsIdx >= 0 ? get(row, coordsIdx) : '').match(
          /(-?\d+[.,]\d+)\s*[,;]\s*(-?\d+[.,]\d+)/,
        );
        if (pair) {
          latitude = parseCoordNumber(pair[1]);
          longitude = parseCoordNumber(pair[2]);
        }
      }

      if (latitude == null || longitude == null) return null;

      const address = String(addressIdx >= 0 ? get(row, addressIdx) : '').trim();

      return {
        name,
        address: address || undefined,
        latitude,
        longitude,
      };
    })
    .filter(Boolean);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const filePath = process.argv[2] || DEFAULT_FILE;
  if (!existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    process.exit(1);
  }

  const workbook = XLSX.read(readFileSync(filePath));
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const items = parseRowsFromObjects(rows);

  if (items.length === 0) {
    console.error('Nenhuma UBS válida na planilha.');
    process.exit(1);
  }

  console.log(`Planilha: ${filePath}`);
  console.log(`UBS encontradas: ${items.length}`);
  items.forEach((row, i) => {
    console.log(`  ${i + 1}. ${row.name} — ${row.latitude}, ${row.longitude}`);
  });

  console.log(`\nConectando em ${BASE}…`);
  const { accessToken, user } = await api('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASS },
  });

  const municipalityId = user.municipalityId;
  if (!municipalityId) throw new Error('Usuário sem município vinculado.');

  const result = await api('/ubs/bulk', {
    method: 'POST',
    token: accessToken,
    body: { municipalityId, items },
  });

  console.log(`\nImportação concluída:`);
  console.log(`  Criadas: ${result.created}`);
  console.log(`  Atualizadas: ${result.updated}`);
  if (result.errors?.length) {
    console.log(`  Avisos: ${result.errors.length}`);
    result.errors.forEach((err) => console.log(`    - Linha ${err.row} (${err.name}): ${err.message}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
