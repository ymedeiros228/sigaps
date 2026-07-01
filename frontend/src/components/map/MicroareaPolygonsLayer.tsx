import { useMemo } from 'react';
import { GeoJSON, Marker } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import L from 'leaflet';
import type { Microarea, Street } from '../../services/api';
import { useMapStore } from '../../store';
import { buildAllMicroareaPolygons } from '../../utils/microareaPolygons';

interface MicroareaPolygonsLayerProps {
  microareas: Microarea[];
  streets: Street[];
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

export function MicroareaPolygonsLayer({
  microareas,
  streets,
}: MicroareaPolygonsLayerProps) {
  const showAreas = useMapStore((s) => s.showEnvelopes);
  const paintMode = useMapStore((s) => s.paintMode);

  const polygons = useMemo(() => {
    if (!showAreas) return [];
    try {
      return buildAllMicroareaPolygons(microareas, streets);
    } catch {
      return [];
    }
  }, [showAreas, microareas, streets]);

  const featureCollection = useMemo(() => {
    const features = polygons
      .filter((p) => p.zone)
      .map((p) => ({
        type: 'Feature' as const,
        properties: {
          name: p.name,
          color: p.color,
          streetCount: p.streetCount,
          acsName: p.acsName,
        },
        geometry: p.zone!,
      }));
    return { type: 'FeatureCollection' as const, features };
  }, [polygons]);

  if (!showAreas || featureCollection.features.length === 0) return null;

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

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const props = feature.properties as {
      name: string;
      streetCount: number;
      acsName?: string;
    };
    const acsLine = props.acsName ? `<br/>ACS: ${props.acsName}` : '';
    layer.bindTooltip(
      `<strong>${props.name}</strong>${acsLine}<br/>${props.streetCount} rua(s)`,
      { sticky: true, className: 'paint-tooltip' },
    );
  };

  return (
    <>
      <GeoJSON
        key={`zones-${featureCollection.features.length}-${paintMode}`}
        data={featureCollection}
        style={style}
        onEachFeature={onEachFeature}
        interactive={false}
      />
      {!paintMode &&
        polygons.map((p) => {
          const [lng, lat] = p.labelPoint.coordinates;
          return (
            <Marker
              key={`label-${p.microareaId}`}
              position={[lat, lng]}
              icon={createLabelIcon(p.name, p.color)}
              interactive={false}
            />
          );
        })}
    </>
  );
}
