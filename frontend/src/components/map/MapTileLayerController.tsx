import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MAP_LABELS_OVERLAY,
  MAP_TILE_LAYERS,
  type MapBaseLayerId,
} from '../../constants/mapTiles';

function createTileLayer(config: (typeof MAP_TILE_LAYERS)[MapBaseLayerId]) {
  const options: L.TileLayerOptions = {
    attribution: config.attribution,
    maxZoom: config.maxZoom ?? 19,
    detectRetina: config.detectRetina ?? false,
  };
  if (config.maxNativeZoom != null) options.maxNativeZoom = config.maxNativeZoom;
  if (config.subdomains) options.subdomains = config.subdomains;

  return L.tileLayer(config.url, options);
}

/** Camada de tiles via API Leaflet (mais estável que react-leaflet TileLayer). */
export function MapTileLayerController({ layerId }: { layerId: MapBaseLayerId }) {
  const map = useMap();

  useEffect(() => {
    const primary = createTileLayer(MAP_TILE_LAYERS[layerId]);
    primary.setZIndex(0);
    primary.addTo(map);

    let labels: L.TileLayer | null = null;
    if (layerId === 'hybrid') {
      labels = L.tileLayer(MAP_LABELS_OVERLAY.url, {
        attribution: MAP_LABELS_OVERLAY.attribution,
        maxZoom: MAP_LABELS_OVERLAY.maxZoom,
        subdomains: MAP_LABELS_OVERLAY.subdomains,
        pane: 'overlayPane',
      });
      labels.addTo(map);
    }

    const fallbacks: L.TileLayer[] = [];
    let switchedToFallback = false;

    const switchToFallback = () => {
      if (layerId === 'map' || switchedToFallback) return;
      switchedToFallback = true;
      map.removeLayer(primary);
      const fallback = createTileLayer(MAP_TILE_LAYERS.map);
      fallback.setZIndex(0);
      fallback.addTo(map);
      fallbacks.push(fallback);
    };

    primary.on('tileerror', switchToFallback);

    const refresh = () => map.invalidateSize({ pan: false });
    refresh();
    const t1 = window.setTimeout(refresh, 200);
    const t2 = window.setTimeout(refresh, 1200);
    const ro = new ResizeObserver(refresh);
    ro.observe(map.getContainer());

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      ro.disconnect();
      primary.off('tileerror', switchToFallback);
      map.removeLayer(primary);
      fallbacks.forEach((layer) => map.removeLayer(layer));
      if (labels) map.removeLayer(labels);
    };
  }, [map, layerId]);

  return null;
}
