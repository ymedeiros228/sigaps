import { Circle, GeoJSON } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { PaintZone } from '../../services/api';
import { useMapStore, useAppStore } from '../../store';

interface PaintZonesLayerProps {
  zones: PaintZone[];
}

export function PaintZonesLayer({ zones }: PaintZonesLayerProps) {
  const draft = useMapStore((s) => s.divisionDraft);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const microareas = useAppStore((s) => s.microareas);
  const draftColor =
    microareas.find((m) => m.id === selectedMicroareaId)?.color ?? '#00A86B';

  const zoneStyle = (color: string): PathOptions => ({
    color,
    weight: 2,
    dashArray: '6 4',
    fillColor: color,
    fillOpacity: 0.15,
  });

  return (
    <>
      {zones.map((zone) => (
        <GeoJSON
          key={zone.id}
          data={
            {
              type: 'Feature',
              properties: {},
              geometry: zone.geojson,
            } as GeoJSON.Feature
          }
          style={zoneStyle(zone.microarea.color)}
        />
      ))}
      {draft && (
        <Circle
          center={[draft.lat, draft.lng]}
          radius={draft.radiusMeters}
          pathOptions={{ ...zoneStyle(draftColor), fillOpacity: 0.22 }}
        />
      )}
    </>
  );
}
