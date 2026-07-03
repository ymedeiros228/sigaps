const res = await fetch('https://sigaps-api.onrender.com/index.html', { cache: 'no-store' });
const html = await res.text();
const assets = html.match(/assets\/[A-Za-z]+-[\w-]+\.(?:js|css)/g) ?? [];
console.log('status:', res.status);
console.log([...new Set(assets)].join('\n'));
