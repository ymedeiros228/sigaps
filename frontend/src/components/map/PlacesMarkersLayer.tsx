import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Place } from '../../services/api';
import { useMapStore } from '../../store';

const KIND_LABEL: Record<string, string> = {
  POVOADO: 'Povoado',
  LOCALIDADE: 'Localidade',
  DISTRITO: 'Distrito',
};

function createPlaceIcon() {
  return L.divIcon({
    className: 'place-map-marker',
    html: `<div style="
      width: 26px;
      height: 26px;
      background: #6D4C41;
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
    ">⌂</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
}

const placeIcon = createPlaceIcon();

interface PlacesMarkersLayerProps {
  places: Place[];
}

export function PlacesMarkersLayer({ places }: PlacesMarkersLayerProps) {
  const showPlaces = useMapStore((s) => s.showPlacesMarkers);
  const paintMode = useMapStore((s) => s.paintMode);

  if (!showPlaces || paintMode || places.length === 0) return null;

  return (
    <>
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.latitude, place.longitude]}
          icon={placeIcon}
          zIndexOffset={400}
        >
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
        </Marker>
      ))}
    </>
  );
}
