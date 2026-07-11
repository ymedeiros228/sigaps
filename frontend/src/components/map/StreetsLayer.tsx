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
import {
  buildStreetMapFeatures,
  effectivePaintSide,
  isDualSideStreet,
  paintStateAtPoint,
  sideLabel,
  streetHasPaint,
  type StreetMapFeature,
} from '../../utils/streetPaintSegments';

const HIT_WEIGHT = 32;
const ERASER_HIT_WEIGHT = 56;
const VIEWPORT_CULL_MIN = 600;

interface StreetsLayerProps {
  streets: Street[];
  onStreetClick: (street: Street, multiSelect?: boolean) => void;
  onStreetPaint: (street: Street, latitude: number, longitude: number) => void;
  onStreetUnpaint: (street: Street, latitude: number, longitude: number) => void;
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
  const paintStreetSide = useMapStore((s) => s.paintStreetSide);
  const activeColor = eraserMode
    ? '#EF5350'
    : microareas.find((m) => m.id === selectedMicroareaId)?.color ?? '#00A86B';
  const dragActionRef = useRef<'paint' | 'unpaint' | null>(null);
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [mapBounds, setMapBounds] = useState(map.getBounds());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverLatLng, setHoverLatLng] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!paintMode) {
      setHoveredId(null);
      setHoverLatLng(null);
    }
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
      dragActionRef.current = null;
      onDragPaintEnd();
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
        streetHasPaint(street) ||
        lineIntersectsBounds(street.geojson, mapBounds),
    );
  }, [streets, mapBounds, selectedIds, dragPaintIds, highlightedId]);

  const featureCtx = useMemo(
    () => ({
      highlightedId,
      selectedIds,
      dragPaintIds,
      activeColor,
      paintStreetSide,
      paintMode,
    }),
    [highlightedId, selectedIds, dragPaintIds, activeColor, paintStreetSide, paintMode],
  );

  const { painted, unpainted, dragPreview, hitFeatures } = useMemo(() => {
    const p: StreetMapFeature[] = [];
    const u: StreetMapFeature[] = [];
    const d: StreetMapFeature[] = [];
    const hits: StreetMapFeature[] = [];

    for (const street of renderStreets) {
      if (!isValidLineString(street.geojson)) continue;
      const built = buildStreetMapFeatures(street, featureCtx);
      for (const f of built.painted) {
        p.push({
          ...f,
          geometry: simplifyLineGeojson(f.geometry, zoom) as GeoJSON.LineString,
        });
      }
      for (const f of built.unpainted) {
        u.push({
          ...f,
          geometry: simplifyLineGeojson(f.geometry, zoom) as GeoJSON.LineString,
        });
      }
      for (const f of built.dragPreview) {
        d.push({
          ...f,
          geometry: simplifyLineGeojson(f.geometry, zoom) as GeoJSON.LineString,
        });
      }
      hits.push({
        type: 'Feature',
        properties: {
          id: street.id,
          streetId: street.id,
          name: street.name,
          streetType: street.streetType ?? 'Rua',
          isDirtRoad: (street.streetType ?? '').toLowerCase().includes('terra'),
          color: street.microarea?.color ?? activeColor,
          microareaName: street.microarea?.name,
          hasMicroarea: streetHasPaint(street),
          highlighted: street.id === highlightedId,
          selected: selectedIds.has(street.id),
          dragPending: dragPaintIds.has(street.id),
          familyCount: street.familyCount ?? 0,
          isPartial: false,
        },
        geometry: simplifyLineGeojson(street.geojson, zoom) as GeoJSON.LineString,
      });
    }

    return { painted: p, unpainted: u, dragPreview: d, hitFeatures: hits };
  }, [renderStreets, featureCtx, zoom, highlightedId, selectedIds, dragPaintIds, activeColor]);

  const features = useMemo(() => [...painted, ...unpainted, ...dragPreview], [painted, unpainted, dragPreview]);

  const interactionVersion = useMemo(
    () =>
      features
        .map((feature) => {
          const props = feature.properties;
          return [
            props.id,
            props.microareaName ?? '',
            props.hasMicroarea ? '1' : '0',
            props.dragPending ? '1' : '0',
            props.selected ? '1' : '0',
            props.highlighted ? '1' : '0',
            props.color,
          ].join(':');
        })
        .join('|'),
    [features],
  );

  const paintVisualVersion = useMemo(
    () =>
      features
        .filter((feature) => feature.properties.hasMicroarea || feature.properties.dragPending)
        .map((feature) => {
          const props = feature.properties;
          return [
            props.id,
            props.color,
            props.hasMicroarea ? '1' : '0',
            props.dragPending ? '1' : '0',
          ].join(':');
        })
        .join('|'),
    [features],
  );

  const maxFamilyCount = useMemo(
    () => Math.max(1, ...streets.map((s) => s.familyCount ?? 0)),
    [streets],
  );

  const heatFeatures = useMemo(() => {
    if (!showHeatmap) return [];
    return hitFeatures;
  }, [hitFeatures, showHeatmap]);

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
    if (!paintMode || !hoveredId || !hoverLatLng) return null;
    const street = streetsById.get(hoveredId);
    if (!street?.geojson) return null;
    const { lat, lng } = hoverLatLng;
    const side = effectivePaintSide(street, lat, lng, paintStreetSide, eraserMode);
    const state = paintStateAtPoint(street, lat, lng, side);
    if (eraserMode && !state.microareaId) return null;
    return {
      type: 'Feature' as const,
      properties: { id: hoveredId },
      geometry: street.geojson,
    };
  }, [paintMode, eraserMode, hoveredId, hoverLatLng, streetsById, paintStreetSide]);

  const hoverPreviewStyle = (): PathOptions => {
    if (eraserMode) {
      return {
        color: '#78909c',
        weight: 6,
        opacity: 0.9,
        dashArray: '5 8',
        lineCap: 'round',
        lineJoin: 'round',
      };
    }
    return unassignedStyle();
  };

  const fc = (list: typeof features) => ({ type: 'FeatureCollection' as const, features: list });

  const paintedHaloStyle = (): PathOptions => ({
    color: '#ffffff',
    weight: 13,
    opacity: 0.98,
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
      weight: eraserMode ? 12 : emphasis ? 10 : 8,
      opacity: 1,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  const systemStreetStyle = (feature?: GeoJSON.Feature): PathOptions => {
    const isDirt = (feature?.properties as { isDirtRoad?: boolean })?.isDirtRoad;
    return {
      color: isDirt ? '#a67c00' : '#546e7a',
      weight: isDirt ? 5 : 4,
      opacity: isDirt ? 0.75 : 0.6,
      dashArray: isDirt ? '4 7' : undefined,
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
      streetId: string;
      name: string;
      streetType: string;
    };
    const street = streetsById.get(props.streetId);
    if (!street) return;

    const path = layer as L.Path;
    const label = formatStreetLabel({ name: props.name, streetType: props.streetType });

    const tooltipForPoint = (lat: number, lng: number) => {
      const side = effectivePaintSide(street, lat, lng, paintStreetSide, eraserMode);
      const state = paintStateAtPoint(street, lat, lng, side);
      const segName = state.segment?.microarea?.name ?? street.microarea?.name;
      const sideText = isDualSideStreet(street) ? ` (${sideLabel(side as 'LEFT' | 'RIGHT' | 'FULL')})` : '';
      if (paintMode) {
        if (eraserMode) {
          return state.microareaId
            ? `Apagar trecho${sideText}: ${label}`
            : `${label} — não pintado aqui`;
        }
        const togglesToUnpaint =
          !!selectedMicroareaId && state.microareaId === selectedMicroareaId;
        return togglesToUnpaint
          ? `Despintar trecho${sideText}: ${label}`
          : `Pintar trecho${sideText}: ${label}`;
      }
      if (segName) return `${label} — ${segName}${sideText}`;
      if (street.familyCount > 0) return `${label} — ${street.familyCount} família(s)`;
      return label;
    };

    const showFixedName =
      !paintMode &&
      !showEnvelopes &&
      streetHasPaint(street) &&
      !(street.paintSegments?.length) &&
      zoom >= 15 &&
      streets.length <= 500;

    if (showFixedName) {
      layer.bindTooltip(label, {
        permanent: true,
        direction: 'center',
        className: 'street-name-label',
        offset: [0, 0],
      });
    } else {
      layer.bindTooltip(tooltipForPoint(0, 0), {
        sticky: true,
        className: paintMode ? 'paint-tooltip' : 'street-tooltip',
      });
    }

    if (paintMode) {
      const applyDragAction = (lat: number, lng: number) => {
        const side = effectivePaintSide(street, lat, lng, paintStreetSide, eraserMode);
        const state = paintStateAtPoint(street, lat, lng, side);
        if (dragActionRef.current === 'unpaint') {
          if (state.microareaId) onStreetUnpaint(street, lat, lng);
        } else if (selectedMicroareaId) {
          onStreetPaint(street, lat, lng);
        }
      };

      layer.on('mouseover', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        const side = effectivePaintSide(street, lat, lng, paintStreetSide, eraserMode);
        const state = paintStateAtPoint(street, lat, lng, side);
        if (eraserMode && !state.microareaId) return;
        setHoveredId(props.streetId);
        setHoverLatLng({ lat, lng });
        path
          .getElement()
          ?.classList.add(
            eraserMode ? 'sigaps-street-eraser-hover' : 'sigaps-street-hover',
          );
        layer.setTooltipContent(tooltipForPoint(lat, lng));
        if (dragActionRef.current) applyDragAction(lat, lng);
      });
      layer.on('mouseout', () => {
        setHoveredId(null);
        setHoverLatLng(null);
        path.getElement()?.classList.remove('sigaps-street-hover', 'sigaps-street-eraser-hover');
      });
      layer.on('mousedown', (e: L.LeafletMouseEvent) => {
        stopMapEvent(e);
        const { lat, lng } = e.latlng;
        const side = effectivePaintSide(street, lat, lng, paintStreetSide, eraserMode);
        const state = paintStateAtPoint(street, lat, lng, side);
        if (eraserMode) {
          if (!state.microareaId) return;
          dragActionRef.current = 'unpaint';
          onStreetUnpaint(street, lat, lng);
          return;
        }
        if (!selectedMicroareaId) return;
        dragActionRef.current = 'paint';
        onStreetPaint(street, lat, lng);
      });
      layer.on('click', stopMapEvent);
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

      {unpainted.length > 0 && !showHeatmap && !paintMode && (
        <GeoJSON
          key={`system-streets-${unpainted.length}-${paintVisualVersion.length}`}
          data={fc(unpainted)}
          style={systemStreetStyle}
          interactive={false}
        />
      )}

      {unpainted.length > 0 && !showHeatmap && paintMode && (
        <GeoJSON
          key={`unpainted-paint-${paintVisualVersion}`}
          data={fc(unpainted)}
          style={unassignedStyle}
          interactive={false}
        />
      )}

      {dragPreview.length > 0 && paintMode && !showHeatmap && (
        <GeoJSON
          key={`drag-preview-${paintVisualVersion}-${activeColor}`}
          data={fc(dragPreview)}
          style={unassignedStyle}
          interactive={false}
        />
      )}

      {painted.length > 0 && !showHeatmap && (
        <>
          <GeoJSON
            key={`painted-halo-${paintVisualVersion}`}
            data={fc(painted)}
            style={paintedHaloStyle}
            interactive={false}
          />
          <GeoJSON
            key={`painted-line-${paintVisualVersion}-${paintMode}-${eraserMode}`}
            data={fc(painted)}
            style={paintedLineStyle}
            interactive={false}
          />
        </>
      )}

      {hoveredFeature && (
        <GeoJSON
          key={`hover-${hoveredId}-${paintMode}-${eraserMode}`}
          data={fc([hoveredFeature as StreetMapFeature])}
          style={hoverPreviewStyle}
          interactive={false}
        />
      )}

      <GeoJSON
        key={`streets-hit-${paintMode}-${eraserMode}-${selectedMicroareaId}-${interactionVersion}`}
        data={fc(hitFeatures)}
        style={() => ({
          color: 'transparent',
          weight: eraserMode ? ERASER_HIT_WEIGHT : HIT_WEIGHT,
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
