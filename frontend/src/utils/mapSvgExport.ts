type StreetFeature = {
  name: string;
  color: string;
  coordinates: [number, number][];
};

function collectBounds(features: StreetFeature[]) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const f of features) {
    for (const [lng, lat] of f.coordinates) {
      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    }
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** SVG vetorial simples das ruas (para QGIS / impressão leve). */
export function streetsToSvg(
  features: StreetFeature[],
  title: string,
  width = 1200,
  height = 900,
): string {
  if (features.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="20" y="40">Sem ruas</text></svg>`;
  }

  const { minLng, minLat, maxLng, maxLat } = collectBounds(features);
  const pad = 0.002;
  const lngSpan = Math.max(maxLng - minLng + pad * 2, 0.001);
  const latSpan = Math.max(maxLat - minLat + pad * 2, 0.001);

  const project = ([lng, lat]: [number, number]) => {
    const x = ((lng - minLng + pad) / lngSpan) * (width - 40) + 20;
    const y = height - 60 - ((lat - minLat + pad) / latSpan) * (height - 80);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  const paths = features
    .map((f) => {
      const d = f.coordinates.map((c, i) => `${i === 0 ? 'M' : 'L'} ${project(c)}`).join(' ');
      return `<path d="${d}" fill="none" stroke="${f.color}" stroke-width="2" stroke-linecap="round"/>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#f5f5f5"/>
  <text x="20" y="28" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">${title}</text>
  ${paths}
  <text x="20" y="${height - 16}" font-family="Inter, Arial, sans-serif" font-size="12" fill="#666">SIGAPS — exportação vetorial</text>
</svg>`;
}
