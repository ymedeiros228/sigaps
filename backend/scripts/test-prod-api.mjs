const BASE = process.env.SIGAPS_API_URL ?? 'https://sigaps-api.onrender.com';
const email = process.env.SIGAPS_EMAIL ?? 'jonas@passagemfranca.ma.gov.br';
const password = process.env.SIGAPS_PASSWORD ?? 'Sigaps@2026';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { status: res.status, contentType: res.headers.get('content-type'), body };
}

const health = await req('/health');
console.log('health', health);

const login = await req('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
console.log('login', login.status, login.body?.user?.municipalityId ?? login.body);

if (login.status !== 201 && login.status !== 200) process.exit(1);

const token = login.body.accessToken;
const muniId = login.body.user.municipalityId;
const auth = { headers: { Authorization: `Bearer ${token}` } };

const db = await req('/health/db');
console.log('health/db', db);

const municipality = await req(`/municipalities/${muniId}`, auth);
console.log('municipality', municipality.status, municipality.contentType, municipality.body?.name ?? municipality.body);

const dashboard = await req(`/dashboard/${muniId}`, auth);
console.log('dashboard', dashboard.status, dashboard.contentType, dashboard.body);

if (dashboard.status !== 200) process.exit(1);
if (typeof dashboard.body?.streets !== 'number') {
  console.error('FAIL: dashboard response invalid');
  process.exit(1);
}
console.log('OK: dashboard working in production');
