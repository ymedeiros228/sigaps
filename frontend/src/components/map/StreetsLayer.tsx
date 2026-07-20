import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { PathOptions } from 'leaflet';
import type { Street, StreetPaintSide } from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { isValidLineString } from '../../utils/geojsonSafe';
import { formatStreetLabel, streetPaintCacheKey } from '../../utils/streetSearch';
import { familyHeatColor } from '../../utils/geo';
import { lineIntersectsBounds, simplifyLineGeojson } from '../../utils/streetViewport';
import {
  buildStreetMapFeatures,
  closestPointAndVertexOnStreet,
  closestEdgeOnStreet,
  edgeEndpointLatLng,
  isEdgePaintedOnSide,
  microPaintSideForScope,
  computeBrushPreviewGeometryByIndex,
  computePaintPreviewGeometry,
  effectivePaintSide,
  isDualSideStreet,
  paintStateAtPoint,
  sideLabel,
  streetHasPaint,
  sliceStreetGeojson,
  streetCoords,
  offsetLineForSide,
  type StreetMapFeature,
} from '../../utils/streetPaintSegments';

const HIT_WEIGHT = 32;
const ERASER_HIT_WEIGHT = 56;
const VIEWPORT_CULL_MIN = 600;

const PAINTED_HALO_STYLE: PathOptions = {
  color: '#ffffff',
  weight: 13,
  opacity: 0.98,
  lineCap: 'round',
  lineJoin: 'round',
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
    color: isDirt ? '#c4a35a' : '#546e7a',
    weight: isDirt ? 5 : 4,
    opacity: isDirt ? 0.8 : 0.55,
    dashArray: isDirt ? '4 8' : '6 6',
    lineCap: 'round',
    lineJoin: 'round',
  };
};

interface StreetsLayerProps {
  streets: Street[];
  onStreetClick: (street: Street, multiSelect?: boolean) => void;
  onStreetPaint: (street: Street, latitude: number, longitude: number) => void;
  onStreetUnpaint: (street: Street, latitude: number, longitude: number) => void;
  onStreetPaintRange: (
    street: Street,
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    side: StreetPaintSide,
  ) => void;
  onStreetUnpaintRange: (
    street: Street,
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    side: StreetPaintSide,
  ) => void;
  onPaintBlocked?: (reason: 'pan') => void;
  onDragPaintEnd: () => void;
}

type BrushSession = {
  streetId: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  startIndex: number;
  endIndex: number;
  side: StreetPaintSide;
  action: 'paint' | 'unpaint';
};

function stopMapEvent(e: L.LeafletMouseEvent) {
  L.DomEvent.stopPropagation(e);
  if (e.originalEvent) L.DomEvent.preventDefault(e.originalEvent);
}

function StreetsLayerComponent({
  streets,
  onStreetClick,
  onStreetPaint,
  onStreetUnpaint,
  onStreetPaintRange,
  onStreetUnpaintRange,
  onPaintBlocked,
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
  const paintScope = useMapStore((s) => s.paintScope);
  const mapPanEnabled = useMapStore((s) => s.mapPanEnabled);
  const addDragPaintId = useMapStore((s) => s.addDragPaintId);
  const activeColor = eraserMode
    ? '#EF5350'
    : microareas.find((m) => m.id === selectedMicroareaId)?.color ?? '#00A86B';
  const dragActionRef = useRef<'paint' | 'unpaint' | null>(null);
  const brushSessionRef = useRef<BrushSession | null>(null);
  const brushMoveListenerRef = useRef<((e: MouseEvent | TouchEvent) => void) | null>(null);
  const brushRafRef = useRef<number | null>(null);
  const brushLastVertexRef = useRef<number | null>(null);
  const brushPreviewActiveRef = useRef(false);
  const brushPreviewLayerRef = useRef<L.Polyline | null>(null);
  const hoverPreviewLayerRef = useRef<L.Polyline | null>(null);
  const featureCacheRef = useRef(
    new Map<
      string,
      {
        painted: StreetMapFeature[];
        unpainted: StreetMapFeature[];
        dragPreview: StreetMapFeature[];
        hitGeom: GeoJSON.LineString;
      }
    >(),
  );
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [mapBounds, setMapBounds] = useState(map.getBounds());

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
    return () =>
      container.classList.remove(
        'sigaps-map-painting',
        'sigaps-map-eraser',
        'sigaps-map-selecting',
        'sigaps-map-brushing',
      );
  }, [map, paintMode, eraserMode]);

  const clearBrushPreviewLayer = () => {
    if (brushPreviewLayerRef.current) {
      map.removeLayer(brushPreviewLayerRef.current);
      brushPreviewLayerRef.current = null;
    }
    brushPreviewActiveRef.current = false;
    map.getContainer().classList.remove('sigaps-map-brushing');
  };

  const clearHoverPreviewLayer = () => {
    if (hoverPreviewLayerRef.current) {
      map.removeLayer(hoverPreviewLayerRef.current);
      hoverPreviewLayerRef.current = null;
    }
  };

  const applyHoverPreviewGeometry = (geom: GeoJSON.LineString | null, eraser: boolean) => {
    if (!geom) {
      clearHoverPreviewLayer();
      return;
    }
    const latlngs = (geom.coordinates as [number, number][]).map(([x, y]) => L.latLng(y, x));
    const style: L.PolylineOptions = eraser
      ? {
          color: '#EF5350',
          weight: 8,
          opacity: 0.85,
          dashArray: '6 6',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }
      : {
          color: activeColor,
          weight: 9,
          opacity: 0.9,
          dashArray: '10 5',
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        };
    if (!hoverPreviewLayerRef.current) {
      hoverPreviewLayerRef.current = L.polyline(latlngs, style).addTo(map);
    } else {
      hoverPreviewLayerRef.current.setLatLngs(latlngs);
      hoverPreviewLayerRef.current.setStyle(style);
    }
  };

  useEffect(
    () => () => {
      clearBrushPreviewLayer();
      clearHoverPreviewLayer();
    },
    [map],
  );

  useEffect(() => {
    if (!paintMode || mapPanEnabled) clearHoverPreviewLayer();
  }, [paintMode, mapPanEnabled, map]);

  const streetsByIdRef = useRef(new Map<string, Street>());
  useEffect(() => {
    const mapById = streetsByIdRef.current;
    const seen = new Set<string>();
    for (const street of streets) {
      seen.add(street.id);
      mapById.set(street.id, street);
    }
    for (const id of [...mapById.keys()]) {
      if (!seen.has(id)) mapById.delete(id);
    }
  }, [streets]);

  const brushContainerRectRef = useRef<DOMRect | null>(null);
  const paintRangeFnRef = useRef(onStreetPaintRange);
  const unpaintRangeFnRef = useRef(onStreetUnpaintRange);
  const dragEndFnRef = useRef(onDragPaintEnd);
  paintRangeFnRef.current = onStreetPaintRange;
  unpaintRangeFnRef.current = onStreetUnpaintRange;
  dragEndFnRef.current = onDragPaintEnd;

  const updateBrushPreviewFromSession = (session: BrushSession, street: Street, eraser: boolean) => {
    const geom = computeBrushPreviewGeometryByIndex(
      street,
      session.startIndex,
      session.endIndex,
      session.side,
      eraser,
    );
    if (!geom) {
      clearBrushPreviewLayer();
      return;
    }
    const latlngs = (geom.coordinates as [number, number][]).map(([lng, lat]) => L.latLng(lat, lng));
    // Tinta sólida — o usuário precisa ver a pintura acompanhar o arraste, não um tracejado.
    const style: L.PolylineOptions = eraser
      ? {
          color: '#EF5350',
          weight: 12,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }
      : {
          color: activeColor,
          weight: 12,
          opacity: 0.98,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        };
    if (!brushPreviewLayerRef.current) {
      brushPreviewLayerRef.current = L.polyline(latlngs, style).addTo(map);
    } else {
      brushPreviewLayerRef.current.setLatLngs(latlngs);
      brushPreviewLayerRef.current.setStyle(style);
    }
    brushPreviewActiveRef.current = true;
    map.getContainer().classList.add('sigaps-map-brushing');
  };

  const stopBrushTracking = () => {
    if (brushRafRef.current != null) {
      cancelAnimationFrame(brushRafRef.current);
      brushRafRef.current = null;
    }
    brushLastVertexRef.current = null;
    brushContainerRectRef.current = null;
    const onMove = brushMoveListenerRef.current;
    if (!onMove) return;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    brushMoveListenerRef.current = null;
  };

  const advanceBrushFromClient = (clientX: number, clientY: number) => {
    const session = brushSessionRef.current;
    if (!session) return;
    const street = streetsByIdRef.current.get(session.streetId);
    if (!street) return;

    let rect = brushContainerRectRef.current;
    if (!rect) {
      rect = map.getContainer().getBoundingClientRect();
      brushContainerRectRef.current = rect;
    }
    const point = L.point(clientX - rect.left, clientY - rect.top);
    const latlng = map.containerPointToLatLng(point);
    const snapped = closestPointAndVertexOnStreet(street, latlng.lat, latlng.lng);
    // Lado fixo no pointerdown — não recalcula side/state a cada move.
    const next: BrushSession = {
      ...session,
      endLat: snapped.lat,
      endLng: snapped.lng,
      endIndex: snapped.vertexIndex,
    };
    brushSessionRef.current = next;

    if (brushLastVertexRef.current === snapped.vertexIndex && brushPreviewActiveRef.current) return;
    brushLastVertexRef.current = snapped.vertexIndex;

    if (brushRafRef.current != null) return;
    brushRafRef.current = requestAnimationFrame(() => {
      brushRafRef.current = null;
      const current = brushSessionRef.current;
      if (!current) return;
      const st = streetsByIdRef.current.get(current.streetId);
      if (!st) return;
      updateBrushPreviewFromSession(current, st, current.action === 'unpaint');
    });
  };

  const startBrushTracking = () => {
    if (brushMoveListenerRef.current) return;
    brushLastVertexRef.current = null;
    brushContainerRectRef.current = map.getContainer().getBoundingClientRect();
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!brushSessionRef.current) return;
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX == null || clientY == null) return;
      if ('touches' in e) e.preventDefault();
      advanceBrushFromClient(clientX, clientY);
    };
    brushMoveListenerRef.current = onMove;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
  };

  useEffect(() => {
    const finishBrush = () => {
      const session = brushSessionRef.current;
      stopBrushTracking();
      if (session) {
        const street = streetsByIdRef.current.get(session.streetId);
        if (street) {
          // Commit com o mesmo lado do preview (não recalcula no mouseup).
          if (session.action === 'unpaint') {
            unpaintRangeFnRef.current(
              street,
              session.startLat,
              session.startLng,
              session.endLat,
              session.endLng,
              session.side,
            );
          } else {
            paintRangeFnRef.current(
              street,
              session.startLat,
              session.startLng,
              session.endLat,
              session.endLng,
              session.side,
            );
          }
        }
        brushSessionRef.current = null;
        clearBrushPreviewLayer();
      }
      dragActionRef.current = null;
      dragEndFnRef.current();
    };
    window.addEventListener('mouseup', finishBrush);
    window.addEventListener('touchend', finishBrush);
    window.addEventListener('touchcancel', finishBrush);
    return () => {
      // Não chama stopBrushTracking aqui: re-render não pode matar o traço no meio.
      window.removeEventListener('mouseup', finishBrush);
      window.removeEventListener('touchend', finishBrush);
      window.removeEventListener('touchcancel', finishBrush);
    };
  }, []);

  const renderStreets = useMemo(() => {
    if (streets.length < VIEWPORT_CULL_MIN) return streets;
    return streets.filter(
      (street) =>
        selectedIds.has(street.id) ||
        dragPaintIds.has(street.id) ||
        street.id === highlightedId ||
        // Em modo pintura, só o viewport (evita manter ~todas as pintadas).
        (!paintMode && streetHasPaint(street)) ||
        lineIntersectsBounds(street.geojson, mapBounds),
    );
  }, [streets, mapBounds, selectedIds, dragPaintIds, highlightedId, paintMode]);

  // Selection flags aplicados depois — cache só depende de pintura/modo/zoom.
  const featureCtx = useMemo(
    () => ({
      highlightedId: null as string | null,
      selectedIds: new Set<string>(),
      dragPaintIds: new Set<string>(),
      activeColor: '#00A86B',
      paintStreetSide,
      paintMode,
      splitUnpaintedEdges: paintMode && paintScope === 'micro',
      microSide: paintMode && paintScope === 'micro' ? microPaintSideForScope(paintStreetSide) : undefined,
    }),
    [paintStreetSide, paintMode, paintScope],
  );

  /** Cache por rua: um traço só reconstrói a rua dirty, não as ~700. */
  const streetFeatureStateRef = useRef(
    new Map<
      string,
      {
        cacheKey: string;
        flagKey: string;
        visualKey: string;
        painted: StreetMapFeature[];
        unpainted: StreetMapFeature[];
        dragPreview: StreetMapFeature[];
        hit: StreetMapFeature;
      }
    >(),
  );
  const visibleStreetIdsRef = useRef(new Set<string>());

  const { painted, unpainted, dragPreview, hitFeatures } = useMemo(() => {
    const p: StreetMapFeature[] = [];
    const u: StreetMapFeature[] = [];
    const d: StreetMapFeature[] = [];
    const hits: StreetMapFeature[] = [];
    const zoomBucket = zoom < 13 ? 12 : zoom < 15 ? 14 : 16;
    const modeKey = `${paintMode ? 1 : 0}:${paintScope}:${paintStreetSide}:${eraserMode ? 1 : 0}:${zoomBucket}`;
    const cache = featureCacheRef.current;
    const streetState = streetFeatureStateRef.current;
    const keep = new Set<string>();
    const keepStreet = new Set<string>();

    for (const street of renderStreets) {
      if (!isValidLineString(street.geojson)) continue;
      const paintKey = streetPaintCacheKey(street);
      const cacheKey = `${paintKey}|${modeKey}`;
      keep.add(cacheKey);
      keepStreet.add(street.id);

      let cached = cache.get(cacheKey);
      if (!cached) {
        const built = buildStreetMapFeatures(street, featureCtx);
        cached = {
          painted: built.painted.map((f) => ({
            ...f,
            geometry: simplifyLineGeojson(f.geometry, zoom) as GeoJSON.LineString,
          })),
          unpainted: built.unpainted.map((f) => ({
            ...f,
            geometry: simplifyLineGeojson(f.geometry, zoom) as GeoJSON.LineString,
          })),
          dragPreview: built.dragPreview.map((f) => ({
            ...f,
            geometry: simplifyLineGeojson(f.geometry, zoom) as GeoJSON.LineString,
          })),
          // Hit em modo pintura usa geometria completa — simplify atrasa o início do traço.
          hitGeom: (paintMode
            ? street.geojson
            : simplifyLineGeojson(street.geojson, zoom)) as GeoJSON.LineString,
        };
        cache.set(cacheKey, cached);
      }

      const highlighted = street.id === highlightedId;
      const selected = selectedIds.has(street.id);
      const dragPending = dragPaintIds.has(street.id);
      const flagKey = `${highlighted ? 1 : 0}${selected ? 1 : 0}${dragPending ? 1 : 0}`;
      const visualKey = `${cacheKey}|${flagKey}`;

      let state = streetState.get(street.id);
      if (!state || state.visualKey !== visualKey) {
        const withFlags = (list: StreetMapFeature[]) =>
          list.map((f) => ({
            ...f,
            properties: { ...f.properties, highlighted, selected, dragPending },
          }));
        state = {
          cacheKey,
          flagKey,
          visualKey,
          painted: withFlags(cached.painted),
          unpainted: withFlags(cached.unpainted),
          dragPreview: withFlags(cached.dragPreview),
          hit: {
            type: 'Feature',
            properties: {
              id: street.id,
              streetId: street.id,
              name: street.name,
              streetType: street.streetType ?? 'Rua',
              isDirtRoad: (street.streetType ?? '').toLowerCase().includes('terra'),
              color: street.microarea?.color ?? '#546e7a',
              microareaName: street.microarea?.name,
              hasMicroarea: streetHasPaint(street),
              highlighted,
              selected,
              dragPending,
              familyCount: street.familyCount ?? 0,
              isPartial: false,
            },
            geometry: cached.hitGeom,
          },
        };
        streetState.set(street.id, state);
      }

      p.push(...state.painted);
      u.push(...state.unpainted);
      d.push(...state.dragPreview);

      if (paintMode && paintScope === 'micro') {
        const microHits = eraserMode ? state.painted : state.unpainted;
        for (const feature of microHits) {
          hits.push({
            ...feature,
            properties: {
              ...feature.properties,
              highlighted,
              selected,
              dragPending,
            },
          });
        }
      } else {
        hits.push(state.hit);
      }
    }

    if (cache.size > keep.size + 80) {
      for (const key of cache.keys()) {
        if (!keep.has(key)) cache.delete(key);
      }
    }
    if (streetState.size > keepStreet.size + 80) {
      for (const id of streetState.keys()) {
        if (!keepStreet.has(id)) streetState.delete(id);
      }
    }
    visibleStreetIdsRef.current = keepStreet;

    return { painted: p, unpainted: u, dragPreview: d, hitFeatures: hits };
  }, [
    renderStreets,
    featureCtx,
    zoom,
    highlightedId,
    selectedIds,
    dragPaintIds,
    paintMode,
    paintStreetSide,
    paintScope,
    eraserMode,
  ]);

  /** Hit layer: remonta quando o conjunto de ruas do viewport muda (não só o count). */
  const hitLayerVersion = useMemo(() => {
    let h = 0;
    for (const feature of hitFeatures) {
      const id = String(feature.properties.streetId ?? feature.properties.id ?? '');
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
    }
    return `${hitFeatures.length}:${h}:${zoom}:${paintMode ? 1 : 0}:${paintScope}:${eraserMode ? 1 : 0}`;
  }, [hitFeatures, zoom, paintMode, paintScope, eraserMode]);

  useEffect(() => {
    if (!map.getPane('streetsHit')) {
      const pane = map.createPane('streetsHit');
      pane.style.zIndex = '450';
    }
  }, [map]);

  /** Versões curtas — pintado e cinza com keys separadas (pintar não remonta tudo). */
  const hashFeatures = (list: typeof painted) => {
    let h = 0;
    for (const feature of list) {
      const p = feature.properties;
      for (let i = 0; i < p.id.length; i++) h = (h * 31 + p.id.charCodeAt(i)) | 0;
      const color = p.color ?? '';
      for (let i = 0; i < color.length; i++) h = (h * 31 + color.charCodeAt(i)) | 0;
      if (p.highlighted) h = (h * 31 + 1) | 0;
      if (p.selected) h = (h * 31 + 2) | 0;
      if (p.dragPending) h = (h * 31 + 3) | 0;
    }
    return `${list.length}:${h}`;
  };
  const paintedVersion = useMemo(() => hashFeatures(painted), [painted]);
  const unpaintedVersion = useMemo(() => hashFeatures(unpainted), [unpainted]);

  const maxFamilyCount = useMemo(
    () => Math.max(1, ...streets.map((s) => s.familyCount ?? 0)),
    [streets],
  );

  const heatFeatures = useMemo(() => {
    if (!showHeatmap) return [];
    return hitFeatures.filter((f) => ((f.properties as { familyCount?: number }).familyCount ?? 0) > 0);
  }, [hitFeatures, showHeatmap]);

  const heatLineStyle = (feature?: GeoJSON.Feature): PathOptions => {
    const count = (feature?.properties as { familyCount?: number })?.familyCount ?? 0;
    return {
      color: familyHeatColor(count, maxFamilyCount),
      weight: 9 + Math.min(5, Math.round(count / Math.max(1, maxFamilyCount / 5))),
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
    };
  };

  const fc = (list: typeof painted) => ({ type: 'FeatureCollection' as const, features: list });

  const paintedHaloStyle = useCallback((): PathOptions => PAINTED_HALO_STYLE, []);

  const paintedLineStyle = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
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
        weight: showHeatmap ? (emphasis ? 7 : 5) : eraserMode ? 12 : emphasis ? 10 : 8,
        opacity: showHeatmap ? 0.55 : 1,
        lineCap: 'round',
        lineJoin: 'round',
      };
    },
    [activeColor, showHeatmap, eraserMode],
  );

  const dragPreviewStyle = useCallback(
    (feature?: GeoJSON.Feature): PathOptions => {
      const isDirt = (feature?.properties as { isDirtRoad?: boolean })?.isDirtRoad;
      return {
        color: isDirt ? '#c4a35a' : activeColor,
        weight: isDirt ? 6 : 7,
        opacity: 0.85,
        dashArray: '4 4',
        lineCap: 'round',
        lineJoin: 'round',
      };
    },
    [activeColor],
  );

  const hitLayerStyle = useCallback(
    (): PathOptions => ({
      color: 'transparent',
      weight:
        paintScope === 'micro' ? 28 : eraserMode ? ERASER_HIT_WEIGHT : HIT_WEIGHT,
      opacity: 0.001,
      lineCap: 'round',
      lineJoin: 'round',
      pane: 'streetsHit',
    }),
    [eraserMode, paintScope],
  );

  const bindInteraction = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const props = feature.properties as {
      id: string;
      streetId: string;
      name: string;
      streetType: string;
      edgeLo?: number;
      edgeHi?: number;
      side?: StreetPaintSide;
    };
    // Sempre a rua atual do cache — hit layer permanece montado após paint.
    const getStreet = () => streetsByIdRef.current.get(props.streetId);
    if (!getStreet()) return;

    const path = layer as L.Path;
    const label = formatStreetLabel({ name: props.name, streetType: props.streetType });

    const pointerPaintContext = (lat: number, lng: number) => {
      const street = getStreet();
      if (!street) return null;
      const store = useMapStore.getState();
      const side = effectivePaintSide(
        street,
        lat,
        lng,
        store.paintStreetSide,
        store.paintScope,
        store.eraserMode,
      ) as StreetPaintSide;
      const state = paintStateAtPoint(street, lat, lng, side);
      let geom: GeoJSON.LineString | null = null;
      if (store.paintMode) {
        if (store.paintScope === 'micro' && props.edgeLo != null && props.edgeHi != null) {
          const raw = sliceStreetGeojson(streetCoords(street.geojson), props.edgeLo, props.edgeHi);
          geom = raw ? offsetLineForSide(raw, side as StreetPaintSide) : null;
        } else {
          geom = computePaintPreviewGeometry(
            street,
            lat,
            lng,
            store.eraserMode ? null : store.selectedMicroareaId,
            side,
            store.paintScope,
            store.eraserMode,
          );
        }
      }
      const segName = state.segment?.microarea?.name ?? street.microarea?.name;
      const sideText = isDualSideStreet(street) ? ` (${sideLabel(side)})` : '';
      let tooltip = label;
      if (store.paintMode) {
        if (store.eraserMode) {
          tooltip = state.microareaId
            ? `Apagar trecho${sideText}: ${label}`
            : `${label} — não pintado aqui`;
        } else {
          const togglesToUnpaint =
            !!store.selectedMicroareaId && state.microareaId === store.selectedMicroareaId;
          tooltip = togglesToUnpaint
            ? `Despintar trecho${sideText}: ${label}`
            : store.paintScope === 'whole'
              ? `Pintar rua inteira: ${label}`
              : store.paintScope === 'micro'
                ? `Micro pintura${sideText}: clique no tracinho — ${label}`
                : store.paintScope === 'brush'
                  ? `Arraste ao longo da rua${sideText}: ${label}`
                  : `Cortar e pintar trecho${sideText}: ${label}`;
        }
      } else if (segName) {
        tooltip = `${label} — ${segName}${sideText}`;
      } else if (street.familyCount > 0) {
        tooltip = `${label} — ${street.familyCount} família(s)`;
      }
      return { street, store, side, state, geom, tooltip };
    };

    const streetAtBind = getStreet()!;
    const showFixedName =
      !paintMode &&
      !showEnvelopes &&
      streetHasPaint(streetAtBind) &&
      !(streetAtBind.paintSegments?.length) &&
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
      layer.bindTooltip(label, {
        sticky: true,
        className: paintMode ? 'paint-tooltip' : 'street-tooltip',
      });
    }

    if (paintMode) {
      const commitMicroEdge = (street: Street, lo: number, hi: number, side: StreetPaintSide) => {
        const store = useMapStore.getState();
        const endpoints = edgeEndpointLatLng(street, lo, hi);
        const state = paintStateAtPoint(street, endpoints.startLat, endpoints.startLng, side);
        if (store.eraserMode) {
          if (!streetHasPaint(street) && !state.microareaId) return;
          onStreetUnpaintRange(
            street,
            endpoints.startLat,
            endpoints.startLng,
            endpoints.endLat,
            endpoints.endLng,
            side,
          );
          return;
        }
        if (!store.selectedMicroareaId) return;
        const painted = isEdgePaintedOnSide(street, lo, hi, side);
        if (painted && state.microareaId === store.selectedMicroareaId) {
          onStreetUnpaintRange(
            street,
            endpoints.startLat,
            endpoints.startLng,
            endpoints.endLat,
            endpoints.endLng,
            side,
          );
          return;
        }
        if (painted) return;
        onStreetPaintRange(
          street,
          endpoints.startLat,
          endpoints.startLng,
          endpoints.endLat,
          endpoints.endLng,
          side,
        );
      };

      const applyDragAction = (lat: number, lng: number) => {
        const street = getStreet();
        if (!street) return;
        if (dragActionRef.current === 'unpaint') {
          if (streetHasPaint(street)) onStreetUnpaint(street, lat, lng);
        } else if (useMapStore.getState().selectedMicroareaId) {
          onStreetPaint(street, lat, lng);
        }
      };

      const handlePointerOver = (e: L.LeafletMouseEvent) => {
        if (brushSessionRef.current?.streetId === props.streetId) return;
        const storeNow = useMapStore.getState();
        if (storeNow.mapPanEnabled) {
          const ctx = pointerPaintContext(e.latlng.lat, e.latlng.lng);
          if (ctx) layer.setTooltipContent(ctx.tooltip);
          return;
        }
        const street = getStreet();
        if (!street) return;
        const snapped = closestPointAndVertexOnStreet(street, e.latlng.lat, e.latlng.lng);
        const ctx = pointerPaintContext(snapped.lat, snapped.lng);
        if (!ctx) return;
        if (ctx.store.eraserMode && !streetHasPaint(street) && !ctx.state.microareaId) return;
        applyHoverPreviewGeometry(ctx.geom, ctx.store.eraserMode);
        path
          .getElement()
          ?.classList.add(
            ctx.store.eraserMode ? 'sigaps-street-eraser-hover' : 'sigaps-street-hover',
          );
        layer.setTooltipContent(ctx.tooltip);
        if (dragActionRef.current && ctx.store.paintScope !== 'brush' && ctx.store.paintScope !== 'micro') {
          applyDragAction(snapped.lat, snapped.lng);
        }
      };

      const handlePointerOut = () => {
        if (brushSessionRef.current?.streetId === props.streetId) return;
        clearHoverPreviewLayer();
        path.getElement()?.classList.remove('sigaps-street-hover', 'sigaps-street-eraser-hover');
      };

      const handlePointerDown = (e: L.LeafletMouseEvent) => {
        stopMapEvent(e);
        const store = useMapStore.getState();
        if (store.mapPanEnabled) {
          onPaintBlocked?.('pan');
          return;
        }
        const street = getStreet();
        if (!street) return;
        const snapped = closestPointAndVertexOnStreet(street, e.latlng.lat, e.latlng.lng);
        const { lat, lng, vertexIndex } = snapped;
        const side = effectivePaintSide(
          street,
          lat,
          lng,
          store.paintStreetSide,
          store.paintScope,
          store.eraserMode,
        ) as StreetPaintSide;
        const state = paintStateAtPoint(street, lat, lng, side);

        if (store.paintScope === 'micro') {
          if (props.edgeLo != null && props.edgeHi != null) {
            commitMicroEdge(street, props.edgeLo, props.edgeHi, side);
            return;
          }
          const edge = closestEdgeOnStreet(street, lat, lng);
          commitMicroEdge(street, edge.lo, edge.hi, side);
          return;
        }

        if (store.paintScope === 'brush') {
          if (store.eraserMode) {
            if (!streetHasPaint(street) && !state.microareaId) return;
            dragActionRef.current = 'unpaint';
            const session: BrushSession = {
              streetId: props.streetId,
              startLat: lat,
              startLng: lng,
              endLat: lat,
              endLng: lng,
              startIndex: vertexIndex,
              endIndex: vertexIndex,
              side,
              action: 'unpaint',
            };
            brushSessionRef.current = session;
            clearHoverPreviewLayer();
            startBrushTracking();
            updateBrushPreviewFromSession(session, street, true);
            return;
          }
          if (!store.selectedMicroareaId) return;
          dragActionRef.current = 'paint';
          const session: BrushSession = {
            streetId: props.streetId,
            startLat: lat,
            startLng: lng,
            endLat: lat,
            endLng: lng,
            startIndex: vertexIndex,
            endIndex: vertexIndex,
            side,
            action: 'paint',
          };
          brushSessionRef.current = session;
          clearHoverPreviewLayer();
          startBrushTracking();
          updateBrushPreviewFromSession(session, street, false);
          return;
        }

        if (store.eraserMode) {
          if (!streetHasPaint(street) && !state.microareaId) return;
          dragActionRef.current = 'unpaint';
          onStreetUnpaint(street, lat, lng);
          return;
        }
        if (!store.selectedMicroareaId) return;
        dragActionRef.current = 'paint';
        addDragPaintId(props.streetId);
        onStreetPaint(street, lat, lng);
      };

      layer.on('mouseover', handlePointerOver);
      layer.on('mouseout', handlePointerOut);
      layer.on('mousedown', handlePointerDown);
      layer.on('touchstart', handlePointerDown as L.LeafletEventHandlerFn);
      layer.on('touchmove', handlePointerOver as L.LeafletEventHandlerFn);
      layer.on('click', stopMapEvent);
      return;
    }

    layer.on('mousedown', stopMapEvent);
    layer.on('click', (e: L.LeafletMouseEvent) => {
      stopMapEvent(e);
      const street = getStreet();
      if (!street) return;
      const multiSelect = !!(e.originalEvent?.ctrlKey || e.originalEvent?.metaKey);
      onStreetClick(street, multiSelect);
    });
  };

  // Durante pintura: FeatureGroups imperativos — só recria polylines da rua dirty.
  const visualGroupsRef = useRef({
    halo: L.featureGroup(),
    painted: L.featureGroup(),
    unpainted: L.featureGroup(),
    drag: L.featureGroup(),
  });
  const visualLayersByStreetRef = useRef(new Map<string, L.Layer[]>());
  const visualKeyByStreetRef = useRef(new Map<string, string>());

  useEffect(() => {
    const groups = visualGroupsRef.current;
    if (!paintMode || showHeatmap) {
      for (const group of Object.values(groups)) {
        group.clearLayers();
        if (map.hasLayer(group)) map.removeLayer(group);
      }
      visualLayersByStreetRef.current.clear();
      visualKeyByStreetRef.current.clear();
      return;
    }

    if (!map.hasLayer(groups.halo)) groups.halo.addTo(map);
    if (!map.hasLayer(groups.painted)) groups.painted.addTo(map);
    if (!map.hasLayer(groups.unpainted)) groups.unpainted.addTo(map);
    if (!map.hasLayer(groups.drag)) groups.drag.addTo(map);

    const toLatLngs = (geom: GeoJSON.LineString) =>
      (geom.coordinates as [number, number][]).map(([lng, lat]) => L.latLng(lat, lng));
    const nonInteractive = { interactive: false as const };
    const styleKey = `${activeColor}|${eraserMode ? 1 : 0}`;
    const visible = visibleStreetIdsRef.current;
    const streetState = streetFeatureStateRef.current;

    // Só ruas dirty / estilo alterado — sem reagrupar nem re-hash das ~700.
    for (const streetId of visible) {
      const bucket = streetState.get(streetId);
      if (!bucket) continue;
      const key = `${bucket.visualKey}|${styleKey}`;
      if (visualKeyByStreetRef.current.get(streetId) === key) continue;

      const old = visualLayersByStreetRef.current.get(streetId);
      if (old) {
        for (const layer of old) {
          groups.halo.removeLayer(layer);
          groups.painted.removeLayer(layer);
          groups.unpainted.removeLayer(layer);
          groups.drag.removeLayer(layer);
        }
      }

      const created: L.Layer[] = [];
      for (const f of bucket.painted) {
        const latlngs = toLatLngs(f.geometry);
        const halo = L.polyline(latlngs, { ...paintedHaloStyle(), ...nonInteractive });
        const line = L.polyline(latlngs, { ...paintedLineStyle(f), ...nonInteractive });
        groups.halo.addLayer(halo);
        groups.painted.addLayer(line);
        created.push(halo, line);
      }
      for (const f of bucket.unpainted) {
        const line = L.polyline(toLatLngs(f.geometry), {
          ...unassignedStyle(f),
          ...nonInteractive,
        });
        groups.unpainted.addLayer(line);
        created.push(line);
      }
      for (const f of bucket.dragPreview) {
        const line = L.polyline(toLatLngs(f.geometry), {
          ...dragPreviewStyle(f),
          ...nonInteractive,
        });
        groups.drag.addLayer(line);
        created.push(line);
      }
      visualLayersByStreetRef.current.set(streetId, created);
      visualKeyByStreetRef.current.set(streetId, key);
    }

    for (const streetId of [...visualKeyByStreetRef.current.keys()]) {
      if (visible.has(streetId)) continue;
      const old = visualLayersByStreetRef.current.get(streetId);
      if (old) {
        for (const layer of old) {
          groups.halo.removeLayer(layer);
          groups.painted.removeLayer(layer);
          groups.unpainted.removeLayer(layer);
          groups.drag.removeLayer(layer);
        }
      }
      visualLayersByStreetRef.current.delete(streetId);
      visualKeyByStreetRef.current.delete(streetId);
    }
  }, [
    map,
    paintMode,
    showHeatmap,
    painted,
    unpainted,
    dragPreview,
    activeColor,
    eraserMode,
    paintedHaloStyle,
    paintedLineStyle,
    dragPreviewStyle,
  ]);

  return (
    <>
      {unpainted.length > 0 && !paintMode && (
        <GeoJSON
          key={`system-streets-${unpaintedVersion}`}
          data={fc(unpainted)}
          style={systemStreetStyle}
          interactive={false}
        />
      )}

      {!paintMode && painted.length > 0 && (
        <>
          <GeoJSON
            key={`painted-halo-${paintedVersion}`}
            data={fc(painted)}
            style={paintedHaloStyle}
            interactive={false}
          />
          <GeoJSON
            key={`painted-line-${paintedVersion}-${paintMode}-${eraserMode}`}
            data={fc(painted)}
            style={paintedLineStyle}
            interactive={false}
          />
        </>
      )}

      {showHeatmap && heatFeatures.length > 0 && (
        <GeoJSON
          key={`heat-${heatFeatures.length}-${maxFamilyCount}-overlay`}
          data={fc(heatFeatures)}
          style={heatLineStyle}
          interactive={false}
        />
      )}

      <GeoJSON
        key={`streets-hit-${hitLayerVersion}`}
        data={fc(hitFeatures)}
        style={hitLayerStyle}
        onEachFeature={bindInteraction}
        interactive
      />
    </>
  );
}

export const StreetsLayer = memo(StreetsLayerComponent);

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
