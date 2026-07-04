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

const iconCache = new Map<string, L.DivIcon>();

function getPlaceIcon(kind: string, microareaColor?: string | null) {
  const key = `${kind}:${microareaColor ?? ''}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const style = KIND_STYLE[kind] ?? KIND_STYLE.POVOADO;
  const bg = microareaColor ?? style.bg;
  const ring = microareaColor
    ? `box-shadow: 0 0 0 3px ${microareaColor}66, 0 2px 8px rgba(0,0,0,0.35);`
    : 'box-shadow: 0 2px 8px rgba(0,0,0,0.35);';
  const icon = L.divIcon({
    className: 'place-map-marker',
    html: `<div style="
      width: 26px;
      height: 26px;
      background: ${bg};
      border: 3px solid #fff;
      border-radius: 50%;
      ${ring}
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
  iconCache.set(key, icon);
  return icon;
}

interface PlacesMarkersLayerProps {
  places: Place[];
  onPaintPlace?: (place: Place) => void;
  onUnpaintPlace?: (place: Place) => void;
}

export function PlacesMarkersLayer({
  places,
  onPaintPlace,
  onUnpaintPlace,
}: PlacesMarkersLayerProps) {
  const showPlaces = useMapStore((s) => s.showPlacesMarkers);
  const paintMode = useMapStore((s) => s.paintMode);
  const eraserMode = useMapStore((s) => s.eraserMode);
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
      {places.map((place) => {
        const painted = !!place.microareaId;
        const paintTooltip = paintMode
          ? eraserMode
            ? painted
              ? `Apagar: ${place.name}`
              : `${place.name} — sem microárea`
            : `Pintar povoado: ${place.name}`
          : null;

        return (
          <Marker
            key={place.id}
            position={[place.latitude, place.longitude]}
            icon={getPlaceIcon(place.kind, place.microarea?.color)}
            zIndexOffset={400}
            eventHandlers={
              paintMode
                ? {
                    click: (e) => {
                      L.DomEvent.stopPropagation(e.originalEvent);
                      if (eraserMode) {
                        if (painted) onUnpaintPlace?.(place);
                      } else {
                        onPaintPlace?.(place);
                      }
                    },
                  }
                : undefined
            }
          >
            {paintMode && paintTooltip ? (
              <Tooltip direction="top" offset={[0, -12]} className="paint-tooltip" sticky>
                {paintTooltip}
              </Tooltip>
            ) : (
              showLabels && (
                <Tooltip
                  permanent
                  direction="bottom"
                  offset={[0, 10]}
                  className="place-name-label"
                >
                  {place.name}
                </Tooltip>
              )
            )}
            {!paintMode && (
              <Popup>
                <strong>{place.name}</strong>
                <br />
                {KIND_LABEL[place.kind] ?? place.kind}
                {place.microarea && (
                  <>
                    <br />
                    <span style={{ color: place.microarea.color, fontWeight: 700 }}>
                      ● {place.microarea.name}
                    </span>
                  </>
                )}
                {place.notes && (
                  <>
                    <br />
                    {place.notes}
                  </>
                )}
              </Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
}
