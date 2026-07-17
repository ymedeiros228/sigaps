import { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';

type MapCursorCoordsTrackerProps = {
  onMove: (latitude: number | null, longitude: number | null) => void;
};

/** Coordenadas do cursor com rAF — evita setState a cada mousemove no mapa inteiro. */
export function MapCursorCoordsTracker({ onMove }: MapCursorCoordsTrackerProps) {
  const onMoveRef = useRef(onMove);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ lat: number | null; lng: number | null } | null>(null);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const flush = () => {
    rafRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    onMoveRef.current(pending.lat, pending.lng);
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
      onMoveRef.current(null, null);
    },
  });

  return null;
}
