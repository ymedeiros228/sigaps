import { useEffect, useMemo, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import {
  MAP_LABELS_OVERLAY,
  MAP_TILE_LAYERS,
  type MapBaseLayerId,
} from '../../constants/mapTiles';

type MapBaseTileLayerProps = {
  layerId: MapBaseLayerId;
};

export function MapBaseTileLayer({ layerId }: MapBaseTileLayerProps) {
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [layerId]);

  const config = useMemo(() => {
    if (useFallback && layerId !== 'map') return MAP_TILE_LAYERS.map;
    return MAP_TILE_LAYERS[layerId];
  }, [layerId, useFallback]);

  const tileKey = `${layerId}-${useFallback ? 'osm-fallback' : 'primary'}`;

  return (
    <>
      <TileLayer
        key={tileKey}
        url={config.url}
        attribution={config.attribution}
        maxZoom={config.maxZoom}
        maxNativeZoom={config.maxNativeZoom}
        subdomains={config.subdomains}
        detectRetina={config.detectRetina}
        eventHandlers={{
          tileerror: () => {
            if (!useFallback && layerId !== 'map') setUseFallback(true);
          },
        }}
      />
      {layerId === 'hybrid' && !useFallback && (
        <TileLayer
          key={`${tileKey}-labels`}
          url={MAP_LABELS_OVERLAY.url}
          attribution={MAP_LABELS_OVERLAY.attribution}
          maxZoom={MAP_LABELS_OVERLAY.maxZoom}
          subdomains={MAP_LABELS_OVERLAY.subdomains}
          pane="overlayPane"
        />
      )}
    </>
  );
}
