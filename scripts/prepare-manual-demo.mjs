/**
 * Prepara dados de demonstração no mapa (somente para capturas do manual).
 */
const BASE = process.env.SIGAPS_URL || 'https://sigaps-api.onrender.com';
const EMAIL = process.env.SIGAPS_EMAIL || 'admin@passagemfranca.ma.gov.br';
const PASS = process.env.SIGAPS_PASS || 'Sigaps@2026';

function streetMidpoint(geojson) {
  const coords = geojson?.coordinates;
  if (!coords?.length) return { lng: 0, lat: 0 };
  const mid = coords[Math.floor(coords.length / 2)];
  return { lng: mid[0], lat: mid[1] };
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
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 120)}`);
  }
  return res.json();
}

export async function prepareManualDemo() {
  console.log('Preparando mapa de demonstração para o manual…');

  const { accessToken, user } = await api('/auth/login', {
    method: 'POST',
    body: { email: EMAIL, password: PASS },
  });
  const municipalityId = user.municipalityId;
  if (!municipalityId) throw new Error('Usuário sem município vinculado.');

  const token = accessToken;

  const places = await api(`/places/municipality/${municipalityId}`, { token });
  if (places.length < 2) {
    try {
      const imported = await api(`/places/import-osm/${municipalityId}`, { method: 'POST', token });
      console.log(`  Povoados OSM: ${imported.imported ?? 0} novos`);
    } catch {
      console.warn('  Povoados: importação ignorada');
    }
  }

  const microareas = await api(`/microareas/municipality/${municipalityId}`, { token });
  if (microareas.length === 0) {
    console.warn('  Sem microáreas — mapa sem pintura de exemplo');
    return { municipalityId, painted: 0 };
  }

  let allStreets = [];
  let page = 1;
  let total = Infinity;
  while (allStreets.length < total && page <= 10) {
    const res = await api(
      `/streets/municipality/${municipalityId}?limit=500&mapOnly=true&page=${page}`,
      { token },
    );
    allStreets = allStreets.concat(res.items ?? []);
    total = res.total ?? allStreets.length;
    if ((res.items ?? []).length === 0) break;
    page++;
  }

  if (allStreets.length === 0) {
    console.warn('  Sem ruas no mapa');
    return { municipalityId, painted: 0 };
  }

  const sorted = [...allStreets].sort((a, b) => streetMidpoint(a.geojson).lng - streetMidpoint(b.geojson).lng);
  const share = Math.min(sorted.length, Math.max(50, Math.floor(sorted.length * 0.38)));
  const perMicro = Math.ceil(share / microareas.length);
  let painted = 0;

  for (let i = 0; i < microareas.length; i++) {
    const batch = sorted.slice(i * perMicro, (i + 1) * perMicro);
    if (batch.length === 0) continue;
    await api('/streets/assign', {
      method: 'POST',
      token,
      body: {
        streetIds: batch.map((s) => s.id),
        microareaId: microareas[i].id,
        forceTransfer: true,
      },
    });
    painted += batch.length;
    console.log(`  Microárea ${microareas[i].number}: ${batch.length} ruas`);
  }

  console.log(`  Total pintado para demo: ${painted} de ${allStreets.length} ruas`);
  return { municipalityId, painted, total: allStreets.length };
}
