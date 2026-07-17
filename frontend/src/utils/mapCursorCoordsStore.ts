/** Store externo — coordenadas do cursor sem re-renderizar o SigapsMap. */

type Listener = (lat: number | null, lng: number | null) => void;

let cursorLat: number | null = null;
let cursorLng: number | null = null;
const listeners = new Set<Listener>();

export function getMapCursorCoords() {
  return { lat: cursorLat, lng: cursorLng };
}

export function setMapCursorCoords(lat: number | null, lng: number | null) {
  if (cursorLat === lat && cursorLng === lng) return;
  cursorLat = lat;
  cursorLng = lng;
  for (const listener of listeners) listener(lat, lng);
}

export function subscribeMapCursorCoords(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
