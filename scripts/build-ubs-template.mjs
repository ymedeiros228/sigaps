/** Gera a planilha unificada de UBS (zona urbana + rural) a partir da produção. */
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const XLSX = require(join(__dirname, '..', 'frontend', 'node_modules', 'xlsx'));

const BASE = process.env.SIGAPS_URL || 'https://sigaps-api.onrender.com';
const EMAIL = process.env.SIGAPS_EMAIL || 'admin@passagemfranca.ma.gov.br';
const PASS = process.env.SIGAPS_PASS || 'Sigaps@2026';

const RURAL = new Set(['alto alegre', 'bacabinha', 'nazaré', 'nazare', 'povoado gato']);

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  return res.json();
}

const { accessToken: token, user } = await api('/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASS },
});

const ubsList = await api(`/ubs/municipality/${user.municipalityId}`, { token });

const rows = ubsList
  .map((u) => ({
    'Nome da UBS': u.name,
    Zona: RURAL.has(u.name.trim().toLowerCase()) ? 'Rural' : 'Urbana',
    Latitude: u.latitude,
    Longitude: u.longitude,
    'Coordenada completa': `${u.latitude}, ${u.longitude}`,
  }))
  .sort((a, b) => a.Zona.localeCompare(b.Zona) || a['Nome da UBS'].localeCompare(b['Nome da UBS']));

const sheet = XLSX.utils.json_to_sheet(rows);
sheet['!cols'] = [{ wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 26 }];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, 'UBS');

const targets = [
  join(__dirname, '..', 'docs', 'templates', 'banco_localizacoes_ubs.xlsx'),
  join(__dirname, '..', 'frontend', 'public', 'templates', 'banco_localizacoes_ubs.xlsx'),
];
for (const target of targets) {
  XLSX.writeFile(wb, target);
  console.log('Gerado:', target);
}
rows.forEach((r) => console.log(`- [${r.Zona}] ${r['Nome da UBS']} — ${r['Coordenada completa']}`));
