import { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import { setMapCursorCoords } from '../../utils/mapCursorCoordsStore';

/** Atualiza store externo com rAF — zero setState no SigapsMap. */
export function MapCursorCoordsTracker() {
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ lat: number | null; lng: number | null } | null>(null);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      setMapCursorCoords(null, null);
    },
    [],
  );

  const flush = () => {
    rafRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    // Durante o traço do pincel, não gasta ciclos no label.
    if (document.querySelector('.sigaps-map-brushing')) return;
    setMapCursorCoords(pending.lat, pending.lng);
  };

  useMapEvents({
    mousemove(e) {
      pendingRef.current = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flush);
    },
    mouseout() {
      pendingRef.current = { lat: null, lng: null };
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setMapCursorCoords(null, null);
    },
  });

  return null;
}
