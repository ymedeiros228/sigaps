import { useMapEvents } from 'react-leaflet';

type MapCursorCoordsTrackerProps = {
  onMove: (latitude: number | null, longitude: number | null) => void;
};

export function MapCursorCoordsTracker({ onMove }: MapCursorCoordsTrackerProps) {
  useMapEvents({
    mousemove(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
    mouseout() {
      onMove(null, null);
    },
  });
  return null;
}
