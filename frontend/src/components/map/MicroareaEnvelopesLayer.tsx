import { useMemo } from 'react';
import { GeoJSON, Marker } from 'react-leaflet';
import { useQuery } from '@tanstack/react-query';
import type { PathOptions } from 'leaflet';
import L from 'leaflet';
import { microareasApi, type Microarea } from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { queryKeys } from '../../utils/queryKeys';

interface MicroareaEnvelopesLayerProps {
  municipalityId: string;
}

function isSeedPlaceholderMicroarea(microarea: Microarea) {
  return (
    /^Microárea territorial \d+ - Passagem Franca$/i.test(microarea.description?.trim() ?? '') &&
    !microarea.ubsId &&
    !microarea.acsId &&
    !microarea.neighborhoodId
  );
}

function createLabelIcon(name: string, color: string) {
  return L.divIcon({
    className: 'microarea-map-label',
    html: `<div style="
      background: ${color};
      color: #fff;
      font-weight: 800;
      font-size: 12px;
      padding: 5px 12px;
      border-radius: 4px;
      border: 2px solid #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      white-space: nowrap;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    ">${name}</div>`,
    iconSize: [140, 32],
    iconAnchor: [70, 16],
  });
}

export function MicroareaEnvelopesLayer({ municipalityId }: MicroareaEnvelopesLayerProps) {
  const showEnvelopes = useMapStore((s) => s.showEnvelopes);
  const paintMode = useMapStore((s) => s.paintMode);
  const microareas = useAppStore((s) => s.microareas);

  const { data: envelopes = [] } = useQuery({
    queryKey: queryKeys.microareaEnvelopes(municipalityId),
    queryFn: () => microareasApi.listEnvelopes(municipalityId).then((r) => r.data),
    enabled: showEnvelopes && !!municipalityId,
    staleTime: 120_000,
  });

  const visibleEnvelopes = useMemo(() => {
    if (microareas.length === 0) return envelopes;
    const visibleIds = new Set(
      microareas
        .filter(
          (microarea) =>
            !isSeedPlaceholderMicroarea(microarea) &&
            (microarea._count?.streets ?? 0) > 0,
        )
        .map((m) => m.id),
    );
    return envelopes.filter((envelope) => visibleIds.has(envelope.id));
  }, [envelopes, microareas]);

  const envelopeVersion = useMemo(
    () =>
      visibleEnvelopes
        .map((envelope) => `${envelope.id}:${envelope.color}`)
        .join('|'),
    [visibleEnvelopes],
  );

  const features = useMemo(
    () =>
      visibleEnvelopes.map((e) => ({
        type: 'Feature' as const,
        properties: {
          name: e.name,
          color: e.color,
          number: e.number,
        },
        geometry: e.geometry,
      })),
    [visibleEnvelopes],
  );

  if (!showEnvelopes || features.length === 0) return null;

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const color = (feature?.properties as { color: string })?.color ?? '#888';
    return {
      color: '#ffffff',
      weight: 2.5,
      opacity: 0.95,
      fillColor: color,
      fillOpacity: paintMode ? 0.32 : 0.42,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  return (
    <>
      <GeoJSON
        key={`envelopes-${envelopeVersion}-${paintMode}`}
        data={{ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection}
        style={style}
        interactive={false}
      />
      {!paintMode &&
        visibleEnvelopes.map((e) => {
          if (e.labelLat == null || e.labelLng == null) return null;
          return (
            <Marker
              key={`label-${e.id}`}
              position={[e.labelLat, e.labelLng]}
              icon={createLabelIcon(e.name, e.color)}
              interactive={false}
            />
          );
        })}
    </>
  );
}
