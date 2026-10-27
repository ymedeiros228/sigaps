import { geoApi } from '../services/api';
import { streetsToSvg } from './mapSvgExport';

// Arquivos do mapa que saem direto da API (sem precisar do mapa aberto na tela):
// usados pelo menu "Arquivos" do mapa e pela página Documentos.

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadStreetsGeoJson(municipalityId: string) {
  const res = await geoApi.exportStreets(municipalityId);
  downloadBlob(
    new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
    'sigaps-ruas.geojson',
  );
}

export async function downloadStreetsKml(municipalityId: string) {
  const res = await geoApi.exportStreetsKml(municipalityId);
  downloadBlob(new Blob([res.data], { type: 'application/vnd.google-earth.kml+xml' }), 'sigaps-ruas.kml');
}

export async function downloadStreetsSvg(municipalityId: string) {
  const res = await geoApi.exportStreets(municipalityId);
  const fc = res.data as GeoJSON.FeatureCollection;
  const features = (fc.features ?? [])
    .filter((f) => f.geometry?.type === 'LineString')
    .map((f) => ({
      name: String((f.properties as { name?: string })?.name ?? 'Rua'),
      color: String((f.properties as { microareaColor?: string })?.microareaColor ?? '#888888'),
      coordinates: (f.geometry as GeoJSON.LineString).coordinates as [number, number][],
    }));
  const title = String((fc as { metadata?: { name?: string } }).metadata?.name ?? 'SIGAPS');
  downloadBlob(new Blob([streetsToSvg(features, title)], { type: 'image/svg+xml' }), 'sigaps-ruas.svg');
}

export async function downloadMicroareasGeoJson(municipalityId: string) {
  const res = await geoApi.exportMicroareas(municipalityId);
  downloadBlob(
    new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
    'sigaps-microareas.geojson',
  );
}
