import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useMapStore } from '../../store';

/** Controla arrastar/zoom do mapa para não conflitar com pintar e selecionar ruas. */
export function MapInteractionController() {
  const paintMode = useMapStore((s) => s.paintMode);
  const mapPanEnabled = useMapStore((s) => s.mapPanEnabled);
  const map = useMap();

  useEffect(() => {
    map.doubleClickZoom.disable();
    map.boxZoom.disable();

    const allowPan = !paintMode || mapPanEnabled;
    const container = map.getContainer();
    if (allowPan) {
      map.dragging.enable();
      container.classList.remove('sigaps-map-locked');
      container.classList.toggle('sigaps-map-pan-active', paintMode && mapPanEnabled);
    } else {
      map.dragging.disable();
      container.classList.add('sigaps-map-locked');
      container.classList.remove('sigaps-map-pan-active');
    }

    return () => {
      map.dragging.enable();
      container.classList.remove('sigaps-map-locked', 'sigaps-map-pan-active');
    };
  }, [map, paintMode, mapPanEnabled]);

  return null;
}
