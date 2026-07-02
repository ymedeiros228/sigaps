import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Ubs } from '../../services/api';
import { useMapStore } from '../../store';

function createUbsIcon() {
  return L.divIcon({
    className: 'ubs-map-marker',
    html: `<div style="
      width: 28px;
      height: 28px;
      background: #1565C0;
      border: 3px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    "><span style="
      transform: rotate(45deg);
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
    ">+</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

const ubsIcon = createUbsIcon();

interface UbsMarkersLayerProps {
  ubsList: Ubs[];
}

export function UbsMarkersLayer({ ubsList }: UbsMarkersLayerProps) {
  const showUbs = useMapStore((s) => s.showUbsMarkers);
  const paintMode = useMapStore((s) => s.paintMode);

  if (!showUbs || paintMode || ubsList.length === 0) return null;

  return (
    <>
      {ubsList.map((ubs) => (
        <Marker
          key={ubs.id}
          position={[ubs.latitude, ubs.longitude]}
          icon={ubsIcon}
          zIndexOffset={500}
        >
          <Popup>
            <strong>{ubs.name}</strong>
            <br />
            {ubs.address}
            {ubs.phone && (
              <>
                <br />
                Tel: {ubs.phone}
              </>
            )}
            {ubs.coordinator && (
              <>
                <br />
                Coord.: {ubs.coordinator}
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </>
  );
}
