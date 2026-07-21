import { toText } from './to-text.util';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function featureCollectionToKml(
  collection: GeoJSON.FeatureCollection,
  documentName: string,
): string {
  const placemarks = collection.features
    .filter((f) => f.geometry?.type === 'LineString')
    .map((feature) => {
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const name = escapeXml(toText(props.name, 'Rua'));
      const microarea = toText(props.microareaName);
      const coords = (feature.geometry as GeoJSON.LineString).coordinates
        .map(([lng, lat]) => `${lng},${lat},0`)
        .join(' ');
      const description = microarea
        ? `<description>Microárea: ${escapeXml(microarea)}</description>`
        : '';
      return `<Placemark><name>${name}</name>${description}<LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
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
