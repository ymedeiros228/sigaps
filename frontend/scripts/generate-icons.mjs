#!/usr/bin/env node
// Gera os ícones PNG do app instalado (PWA e iPhone) a partir de public/favicon.svg.
//
// O sharp NÃO fica no package.json (só é preciso quando o ícone muda). Para rodar:
//   npm install --no-save sharp@0.35.5
//   npm run generate:icons
//
// Saídas em public/icons/:
//   pwa-192.png, pwa-512.png   ícone "any": o SVG como é (cantos arredondados)
//   pwa-maskable-512.png       "maskable": fundo verde sem transparência e o desenho
//                              dentro da zona segura (círculo de 80% do lado), porque
//                              o Android recorta em círculo, gota, quadrado...
//   apple-touch-icon.png       180x180, fundo cheio (o iOS pinta de preto o transparente
//                              e arredonda os cantos sozinho)

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('[generate:icons] sharp não instalado. Rode: npm install --no-save sharp@0.35.5');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '..', 'public');
const outDir = join(publicDir, 'icons');
mkdirSync(outDir, { recursive: true });

const svg = readFileSync(join(publicDir, 'favicon.svg'), 'utf8');

// Fundo do favicon (o <rect> arredondado) e o desenho (o resto).
const rect = svg.match(/<rect\b[^>]*\/>/);
if (!rect) throw new Error('favicon.svg sem o <rect> de fundo');
const background = rect[0].match(/fill="([^"]+)"/)?.[1] ?? '#00A86B';
const glyph = svg
  .replace(/^[\s\S]*?<svg\b[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(rect[0], '');

/** Fundo quadrado sem transparência e o desenho reduzido em volta do centro. */
function fullBleed(scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${background}" />
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${glyph}</g>
</svg>`;
}

async function render(source, size, file) {
  await sharp(Buffer.from(source), { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, file));
  console.log(`  ${file} (${size}x${size})`);
}

console.log('Gerando ícones em public/icons:');
await render(svg, 192, 'pwa-192.png');
await render(svg, 512, 'pwa-512.png');
// 0.8: o pino (300x344 no SVG) fica com folga dentro do círculo seguro de 409,6 px.
await render(fullBleed(0.8), 512, 'pwa-maskable-512.png');
await render(fullBleed(0.9), 180, 'apple-touch-icon.png');
