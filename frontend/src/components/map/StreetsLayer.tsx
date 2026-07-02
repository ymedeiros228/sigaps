import { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import type { Street } from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { isValidLineString } from '../../utils/geojsonSafe';
import { formatStreetLabel } from '../../utils/streetSearch';
import { familyHeatColor } from '../../utils/geo';
import { lineIntersectsBounds, simplifyLineGeojson } from '../../utils/streetViewport';

const HIT_WEIGHT = 32;
const VIEWPORT_CULL_MIN = 600;

interface StreetsLayerProps {
  streets: Street[];
  onStreetClick: (street: Street, multiSelect?: boolean) => void;
  onStreetPaint: (street: Street) => void;
  onStreetUnpaint: (street: Street) => void;
  onDragPaintEnd: () => void;
}

function stopMapEvent(e: L.LeafletMouseEvent) {
  L.DomEvent.stopPropagation(e);
  if (e.originalEvent) L.DomEvent.preventDefault(e.originalEvent);
}

export function StreetsLayer({
  streets,
  onStreetClick,
  onStreetPaint,
  onStreetUnpaint,
  onDragPaintEnd,
}: StreetsLayerProps) {
  const highlightedId = useMapStore((s) => s.highlightedStreetId);
  const selectedIds = useMapStore((s) => s.selectedStreetIds);
  const dragPaintIds = useMapStore((s) => s.dragPaintIds);
  const paintMode = useMapStore((s) => s.paintMode);
  const eraserMode = useMapStore((s) => s.eraserMode);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const showEnvelopes = useMapStore((s) => s.showEnvelopes);
  const showHeatmap = useMapStore((s) => s.showHeatmap);
  const microareas = useAppStore((s) => s.microareas);
  const activeColor = eraserMode
    ? '#EF5350'
    : microareas.find((m) => m.id === selectedMicroareaId)?.color ?? '#00A86B';
  const isPaintingDragRef = useRef(false);
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [mapBounds, setMapBounds] = useState(map.getBounds());
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!paintMode) setHoveredId(null);
  }, [paintMode]);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    const onMove = () => setMapBounds(map.getBounds());
    map.on('zoomend', onZoom);
    map.on('moveend', onMove);
    return () => {
      map.off('zoomend', onZoom);
      map.off('moveend', onMove);
    };
  }, [map]);

  useEffect(() => {
    const container = map.getContainer();
    container.classList.toggle('sigaps-map-painting', paintMode);
    container.classList.toggle('sigaps-map-eraser', paintMode && eraserMode);
    container.classList.toggle('sigaps-map-selecting', !paintMode);
    return () => container.classList.remove('sigaps-map-painting', 'sigaps-map-eraser', 'sigaps-map-selecting');
  }, [map, paintMode, eraserMode]);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isPaintingDragRef.current) {
        isPaintingDragRef.current = false;
        onDragPaintEnd();
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [onDragPaintEnd]);

  const renderStreets = useMemo(() => {
    if (streets.length < VIEWPORT_CULL_MIN) return streets;
    return streets.filter(
      (street) =>
        selectedIds.has(street.id) ||
        dragPaintIds.has(street.id) ||
        street.id === highlightedId ||
        !!street.microareaId ||
        lineIntersectsBounds(street.geojson, mapBounds),
    );
  }, [streets, mapBounds, selectedIds, dragPaintIds, highlightedId]);

  const features = useMemo(
    () =>
      renderStreets
        .filter((street) => isValidLineString(street.geojson))
        .map((street) => ({
        type: 'Feature' as const,
        properties: {
          id: street.id,
          name: street.name,
          streetType: street.streetType ?? 'Rua',
          isDirtRoad: (street.streetType ?? '').toLowerCase().includes('terra'),
          color: street.microarea?.color ?? '#888',
          microareaName: street.microarea?.name,
          hasMicroarea: !!street.microareaId,
          highlighted: street.id === highlightedId,
          selected: selectedIds.has(street.id),
          dragPending: dragPaintIds.has(street.id),
          familyCount: street.familyCount ?? 0,
        },
        geometry: simplifyLineGeojson(street.geojson, zoom),
      })),
    [renderStreets, highlightedId, selectedIds, dragPaintIds, zoom],
  );

  const { painted } = useMemo(() => {
    const p: typeof features = [];
    for (const f of features) {
      if (f.properties.hasMicroarea || f.properties.dragPending) p.push(f);
    }
    return { painted: p };
  }, [features]);

  const maxFamilyCount = useMemo(
    () => Math.max(1, ...streets.map((s) => s.familyCount ?? 0)),
    [streets],
  );

  const heatFeatures = useMemo(() => {
    if (!showHeatmap) return [];
    return features;
  }, [features, showHeatmap]);

  const heatLineStyle = (feature?: GeoJSON.Feature): PathOptions => {
    const count = (feature?.properties as { familyCount?: number })?.familyCount ?? 0;
    return {
      color: familyHeatColor(count, maxFamilyCount),
      weight: count > 0 ? 5 + Math.min(4, count) : 3,
      opacity: count > 0 ? 0.9 : 0.35,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  const streetsById = useMemo(
    () => new Map(streets.map((street) => [street.id, street])),
    [streets],
  );

  const hoveredFeature = useMemo(() => {
    if (!paintMode || !hoveredId) return null;
    const street = streetsById.get(hoveredId);
    if (!street?.geojson) return null;
    return {
      type: 'Feature' as const,
      properties: { id: hoveredId },
      geometry: street.geojson,
    };
  }, [paintMode, hoveredId, streetsById]);

  const fc = (list: typeof features) => ({ type: 'FeatureCollection' as const, features: list });

  const paintedHaloStyle = (): PathOptions => ({
    color: '#ffffff',
    weight: 12,
    opacity: 0.95,
    lineCap: 'round',
    lineJoin: 'round',
  });

  const paintedLineStyle = (feature?: GeoJSON.Feature): PathOptions => {
    const props = feature?.properties as {
      color: string;
      highlighted: boolean;
      selected: boolean;
      dragPending: boolean;
    };
    const color = props?.dragPending ? activeColor : props?.color ?? activeColor;
    const emphasis = props?.highlighted || props?.selected || props?.dragPending;
    return {
      color,
      weight: emphasis ? 9 : 7,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  const unassignedStyle = (feature?: GeoJSON.Feature): PathOptions => {
    const isDirt = (feature?.properties as { isDirtRoad?: boolean })?.isDirtRoad;
    return {
      color: isDirt ? '#c4a35a' : activeColor,
      weight: isDirt ? 6 : 7,
      opacity: isDirt ? 0.85 : 0.65,
      dashArray: isDirt ? '4 8' : '8 6',
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  const bindInteraction = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const props = feature.properties as {
      id: string;
      name: string;
      streetType: string;
      microareaName?: string;
      hasMicroarea: boolean;
    };
    const street = streetsById.get(props.id);
    if (!street) return;

    const path = layer as L.Path;
    const label = formatStreetLabel({ name: props.name, streetType: props.streetType });
    const tooltipText = paintMode
      ? eraserMode
        ? props.hasMicroarea
          ? `Apagar: ${label}`
          : `${label} — não pintada`
        : `Pintar: ${label}`
      : props.microareaName
        ? `${label} — ${props.microareaName}`
        : street.familyCount > 0
          ? `${label} — ${street.familyCount} família(s)`
          : label;

    // Nomes fixos no mapa ficam acima das microáreas (pane de tooltip do Leaflet).
    // Só exibir fixo quando microáreas estão ocultas; com microáreas visíveis, usar hover.
    const showFixedName =
      !paintMode &&
      !showEnvelopes &&
      props.hasMicroarea &&
      zoom >= 16 &&
      streets.length <= 500;

    if (showFixedName) {
      layer.bindTooltip(label, {
        permanent: true,
        direction: 'center',
        className: 'street-name-label',
        offset: [0, 0],
      });
    } else {
      layer.bindTooltip(tooltipText, {
        sticky: true,
        className: paintMode ? 'paint-tooltip' : 'street-tooltip',
      });
    }

    if (paintMode) {
      layer.on('mouseover', () => {
        if (eraserMode && !props.hasMicroarea) return;
        setHoveredId(props.id);
        path.getElement()?.classList.add(eraserMode ? 'sigaps-street-eraser-hover' : 'sigaps-street-hover');
        if (isPaintingDragRef.current) {
          if (eraserMode) {
            if (props.hasMicroarea) onStreetUnpaint(street);
          } else if (selectedMicroareaId) {
            onStreetPaint(street);
          }
        }
      });
      layer.on('mouseout', () => {
        setHoveredId(null);
        path.getElement()?.classList.remove('sigaps-street-hover', 'sigaps-street-eraser-hover');
      });
      layer.on('mousedown', (e: L.LeafletMouseEvent) => {
        stopMapEvent(e);
        if (eraserMode) {
          if (!props.hasMicroarea) return;
          isPaintingDragRef.current = true;
          onStreetUnpaint(street);
          return;
        }
        if (!selectedMicroareaId) return;
        isPaintingDragRef.current = true;
        onStreetPaint(street);
      });
      layer.on('click', (e: L.LeafletMouseEvent) => {
        stopMapEvent(e);
        if (eraserMode) {
          if (props.hasMicroarea) onStreetUnpaint(street);
          return;
        }
        if (selectedMicroareaId) onStreetPaint(street);
      });
      return;
    }

    layer.on('mousedown', stopMapEvent);
    layer.on('click', (e: L.LeafletMouseEvent) => {
      stopMapEvent(e);
      const multiSelect = !!(e.originalEvent?.ctrlKey || e.originalEvent?.metaKey);
      onStreetClick(street, multiSelect);
    });
  };

  return (
    <>
      {showHeatmap && heatFeatures.length > 0 && (
        <GeoJSON
          key={`heat-${heatFeatures.length}-${maxFamilyCount}`}
          data={fc(heatFeatures)}
          style={heatLineStyle}
          interactive={false}
        />
      )}

      {painted.length > 0 && !showHeatmap && (
        <>
          <GeoJSON
            key={`painted-halo-${painted.length}`}
            data={fc(painted)}
            style={paintedHaloStyle}
            interactive={false}
          />
          <GeoJSON
            key={`painted-line-${painted.length}-${paintMode}`}
            data={fc(painted)}
            style={paintedLineStyle}
            interactive={false}
          />
        </>
      )}

      {hoveredFeature && (
        <GeoJSON
          key={`hover-${hoveredId}-${paintMode}`}
          data={fc([hoveredFeature as (typeof features)[number]])}
          style={unassignedStyle}
          interactive={false}
        />
      )}

      <GeoJSON
        key={`streets-hit-${paintMode}-${eraserMode}-${selectedMicroareaId}`}
        data={fc(features)}
        style={() => ({
          color: 'transparent',
          weight: HIT_WEIGHT,
          opacity: 0.001,
          lineCap: 'round',
          lineJoin: 'round',
        })}
        onEachFeature={bindInteraction}
        interactive
      />
    </>
  );
}

export function MapCenterController() {
  const map = useMap();
  const mapFlyTarget = useMapStore((s) => s.mapFlyTarget);
  const clearMapFly = useMapStore((s) => s.clearMapFly);

  useEffect(() => {
    if (!mapFlyTarget) return;

    const onEnd = () => clearMapFly();
    map.once('moveend', onEnd);

    if (mapFlyTarget.bounds) {
      map.flyToBounds(mapFlyTarget.bounds, {
        padding: [48, 48],
        maxZoom: mapFlyTarget.zoom,
        duration: 0.75,
      });
    } else {
      map.flyTo([mapFlyTarget.lat, mapFlyTarget.lng], mapFlyTarget.zoom, { duration: 0.75 });
    }

    return () => {
      map.off('moveend', onEnd);
    };
  }, [map, mapFlyTarget?.seq, clearMapFly, mapFlyTarget]);

  return null;
}
