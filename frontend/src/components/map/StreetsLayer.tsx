import { useEffect, useMemo } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import type { Street } from '../../services/api';
import { useMapStore } from '../../store';

const DEFAULT_COLOR = '#888888';

interface StreetsLayerProps {
  streets: Street[];
  onStreetClick: (street: Street, multiSelect?: boolean) => void;
}

export function StreetsLayer({ streets, onStreetClick }: StreetsLayerProps) {
  const highlightedId = useMapStore((s) => s.highlightedStreetId);
  const selectedIds = useMapStore((s) => s.selectedStreetIds);
  const paintMode = useMapStore((s) => s.paintMode);

  const features = useMemo(
    () =>
      streets.map((street) => ({
        type: 'Feature' as const,
        properties: {
          id: street.id,
          name: street.name,
          color: street.microarea?.color ?? DEFAULT_COLOR,
          microareaName: street.microarea?.name,
          highlighted: street.id === highlightedId,
          selected: selectedIds.has(street.id),
        },
        geometry: street.geojson,
      })),
    [streets, highlightedId, selectedIds],
  );

  const style = (feature?: GeoJSON.Feature): PathOptions => {
    const props = feature?.properties as {
      color: string;
      highlighted: boolean;
      selected: boolean;
    };
    return {
      color: props?.color ?? DEFAULT_COLOR,
      weight: props?.highlighted || props?.selected ? 6 : 4,
      opacity: props?.highlighted ? 1 : 0.85,
    };
  };

  const onEachFeature = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const props = feature.properties as { name: string; microareaName?: string };
    layer.bindTooltip(props.name, { sticky: true });
    layer.on('click', (e: L.LeafletMouseEvent) => {
      const street = streets.find((s) => s.id === (feature.properties as { id: string }).id);
      if (street) onStreetClick(street, e.originalEvent.ctrlKey || e.originalEvent.metaKey);
    });
    if (paintMode) {
      (layer as L.Path).bringToFront();
    }
  };

  return (
    <GeoJSON
      key={`streets-${streets.length}-${highlightedId}-${selectedIds.size}`}
      data={{ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection}
      style={style}
      onEachFeature={onEachFeature}
    />
  );
}

export function MapCenterController({
  lat,
  lng,
  zoom,
}: {
  lat: number;
  lng: number;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}
