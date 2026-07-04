import { useEffect, useState } from 'react';
import { Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Place } from '../../services/api';
import { useMapStore } from '../../store';

const KIND_LABEL: Record<string, string> = {
  POVOADO: 'Povoado',
  LOCALIDADE: 'Localidade',
  DISTRITO: 'Distrito',
};

const KIND_STYLE: Record<string, { bg: string; glyph: string }> = {
  POVOADO: { bg: '#6D4C41', glyph: '⌂' },
  LOCALIDADE: { bg: '#546E7A', glyph: '▲' },
  DISTRITO: { bg: '#1565C0', glyph: '★' },
};

/** Nomes fixos aparecem a partir deste zoom (visão rural do município). */
const LABEL_MIN_ZOOM = 12;

function createPlaceIcon(kind: string) {
  const style = KIND_STYLE[kind] ?? KIND_STYLE.POVOADO;
  return L.divIcon({
    className: 'place-map-marker',
    html: `<div style="
      width: 26px;
      height: 26px;
      background: ${style.bg};
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    "><span style="
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      line-height: 1;
    ">${style.glyph}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

const ICONS: Record<string, L.DivIcon> = {
  POVOADO: createPlaceIcon('POVOADO'),
  LOCALIDADE: createPlaceIcon('LOCALIDADE'),
  DISTRITO: createPlaceIcon('DISTRITO'),
};

interface PlacesMarkersLayerProps {
  places: Place[];
}

export function PlacesMarkersLayer({ places }: PlacesMarkersLayerProps) {
  const showPlaces = useMapStore((s) => s.showPlacesMarkers);
  const paintMode = useMapStore((s) => s.paintMode);
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map]);

  if (!showPlaces || places.length === 0) return null;

  const showLabels = zoom >= LABEL_MIN_ZOOM && zoom <= 16;

  return (
    <>
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={ICONS[place.kind] ?? ICONS.POVOADO}
          zIndexOffset={400}
          interactive={!paintMode}
          opacity={paintMode ? 0.75 : 1}
        >
          {showLabels && (
            <Tooltip
              permanent
              direction="bottom"
              offset={[0, 10]}
              className="place-name-label"
            >
              {place.name}
            </Tooltip>
          )}
          {!paintMode && (
            <Popup>
              <strong>{place.name}</strong>
              <br />
              {KIND_LABEL[place.kind] ?? place.kind}
              {place.notes && (
                <>
                  <br />
                  {place.notes}
                </>
              )}
            </Popup>
          )}
        </Marker>
      ))}
    </>
  );
}
