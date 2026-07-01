import { useEffect, useMemo } from 'react';
import { GeoJSON } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import type { PathOptions } from 'leaflet';
import { microareasApi, type Microarea } from '../../services/api';
import { useMapStore } from '../../store';

interface MicroareaEnvelopesLayerProps {
  microareas: Microarea[];
}

export function MicroareaEnvelopesLayer({ microareas }: MicroareaEnvelopesLayerProps) {
  const showEnvelopes = useMapStore((s) => s.showEnvelopes);

  const { data: envelopes = [] } = useQuery({
    queryKey: ['envelopes', microareas.map((m) => m.id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        microareas.map(async (m) => {
          try {
            const res = await microareasApi.envelope(m.id);
            return { microarea: m, geojson: res.data as GeoJSON.Polygon | null };
          } catch {
            return { microarea: m, geojson: null };
          }
        }),
      );
      return results.filter((r) => r.geojson);
    },
    enabled: showEnvelopes && microareas.length > 0,
    staleTime: 60_000,
  });

  const features = useMemo(
    () =>
      envelopes
        .filter((e) => e.geojson)
        .map((e) => ({
          type: 'Feature' as const,
          properties: {
            name: e.microarea.name,
            color: e.microarea.color,
          },
          geometry: e.geojson!,
        })),
    [envelopes],
  );

  if (!showEnvelopes || features.length === 0) return null;

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const color = (feature?.properties as { color: string })?.color ?? '#888';
    return {
      color,
      weight: 2,
      fillColor: color,
      fillOpacity: 0.15,
      dashArray: '6 4',
    };
  };

  return (
    <GeoJSON
      key={`envelopes-${features.length}`}
      data={{ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection}
      style={style}
    />
  );
}
