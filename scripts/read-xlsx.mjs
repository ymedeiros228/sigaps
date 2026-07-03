/** Lê uma planilha Excel e imprime as linhas em JSON. */
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require(join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'node_modules', 'xlsx'));

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/read-xlsx.mjs <arquivo.xlsx>');
  process.exit(1);
}

const wb = XLSX.readFile(file);
for (const sheetName of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  console.log(`Sheet: ${sheetName} (${rows.length} linhas)`);
  if (rows.length > 0) console.log('Colunas:', Object.keys(rows[0]).join(' | '));
  rows.forEach((r, i) => console.log(`${i + 1}.`, JSON.stringify(r)));
}
