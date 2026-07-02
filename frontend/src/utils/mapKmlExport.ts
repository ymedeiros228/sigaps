function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function geojsonToKml(
  collection: GeoJSON.FeatureCollection,
  documentName: string,
): string {
  const placemarks = collection.features
    .filter((f) => f.geometry?.type === 'LineString')
    .map((feature) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const name = escapeXml(String(props.name ?? 'Rua'));
      const coords = (feature.geometry as GeoJSON.LineString).coordinates
        .map(([lng, lat]) => `${lng},${lat},0`)
        .join(' ');
      return `<Placemark><name>${name}</name><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${escapeXml(documentName)}</name>
    ${placemarks}
  </Document>
</kml>`;
}
