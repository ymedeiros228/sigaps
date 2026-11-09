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

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** Ícone do povoado na foto do PDF: bolinha e nome juntos, para o html2canvas pegar certinho. */
function pdfPlaceIcon(place: Place, opts: { inArea: boolean; showLabel: boolean; scale: number }) {
  const { inArea, showLabel, scale } = opts;
  const style = KIND_STYLE[place.kind] ?? KIND_STYLE.POVOADO;
  const color = place.microarea?.color ?? style.bg;
  const dot = Math.round((inArea ? 24 : 18) * scale);
  const font = Math.round((inArea ? 13 : 10) * scale);
  const label = showLabel
    ? `<div class="pdf-label" data-prio="${inArea ? 3 : 1}" style="position:absolute;top:${dot + 2}px;left:50%;transform:translateX(-50%);white-space:nowrap;
        font:${inArea ? 800 : 600} ${font}px/1.15 Arial,sans-serif;color:${inArea ? '#3e2723' : '#6d6d6d'};
        text-shadow:-1.5px -1.5px 0 #fff,1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px 1.5px 0 #fff,0 0 4px #fff;">${escapeHtml(place.name)}</div>`
    : '';
  return L.divIcon({
    className: 'place-map-marker',
    html: `<div style="position:relative;width:${dot}px;height:${dot}px;opacity:${inArea ? 1 : 0.5};">
      <div class="pdf-dot" style="width:${dot}px;height:${dot}px;background:${inArea ? color : '#8d8d8d'};border:${inArea ? 3 : 2}px solid #fff;
        border-radius:50%;box-shadow:0 1px 5px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;
        color:#fff;font:800 ${Math.round(dot * 0.5)}px/1 Arial,sans-serif;">${style.glyph}</div>${label}
    </div>`,
    iconSize: [dot, dot],
    iconAnchor: [dot / 2, dot / 2],
  });
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
  const pdfCapture = useMapStore((s) => s.pdfCapture);
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => {
      map.off('zoomend', onZoom);
    };
  }, [map]);

  if (pdfCapture) {
    const areaIds = new Set(pdfCapture.microareaIds);
    return (
      <>
        {places.map((place) => {
          const inArea = !!place.microareaId && areaIds.has(place.microareaId);
          if (!inArea && pdfCapture.otherPlaces === 'esconder') return null;
          const showLabel =
            pdfCapture.placeLabels === 'todos' || (pdfCapture.placeLabels === 'area' && inArea);
          return (
            <Marker
              key={place.id}
              position={[place.latitude, place.longitude]}
              icon={pdfPlaceIcon(place, {
                inArea: inArea || pdfCapture.otherPlaces === 'normal',
                showLabel,
                scale: pdfCapture.labelScale,
              })}
              zIndexOffset={inArea ? 700 : 200}
              interactive={false}
            />
          );
        })}
      </>
    );
  }

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
              // key: o react-leaflet não troca a opção "permanent" de um tooltip já criado;
              // sem remontar, o rótulo fixo do povoado virava "Pintar povoado" fixo na tela.
              <Tooltip key="paint" direction="top" offset={[0, -12]} className="paint-tooltip" sticky>
                {paintTooltip}
              </Tooltip>
            ) : (
              showLabels && (
                <Tooltip
                  key="label"
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
