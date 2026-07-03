import type { UbsImportRow } from '../../utils/parseUbsSpreadsheet';
import { GeoImportPreviewMap, type GeoImportPoint } from './GeoImportPreviewMap';

type UbsImportPreviewMapProps = {
  rows: UbsImportRow[];
  center: { lat: number; lng: number };
  height?: number;
};

export function UbsImportPreviewMap({ rows, center, height }: UbsImportPreviewMapProps) {
  const points: GeoImportPoint[] = rows.map((row) => ({
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    subtitle: row.address,
    markerColor: '#1565C0',
  }));

  return (
    <GeoImportPreviewMap
      points={points}
      center={center}
      height={height}
      defaultMarkerColor="#1565C0"
    />
  );
}
