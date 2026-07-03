import { useEffect } from 'react';
import { Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography } from '@mui/material';
import { LeafletMap } from '../map/LeafletMap';

const SATELLITE_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri',
};

const pickerIcon = L.divIcon({
  className: 'place-picker-marker',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #1565C0;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 10px rgba(0,0,0,0.45);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapViewController({
  latitude,
  longitude,
  center,
}: {
  latitude: number | null;
  longitude: number | null;
  center: { lat: number; lng: number };
}) {
  const map = useMap();

  useEffect(() => {
    if (latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
      map.setView([latitude, longitude], Math.max(map.getZoom(), 14), { animate: false });
      return;
    }
    map.setView([center.lat, center.lng], 13, { animate: false });
  }, [latitude, longitude, center.lat, center.lng, map]);

  return null;
}

type PlaceCoordinatePickerProps = {
  latitude: number | null;
  longitude: number | null;
  center: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
  height?: number;
};

export function PlaceCoordinatePicker({
  latitude,
  longitude,
  center,
  onChange,
  height = 260,
}: PlaceCoordinatePickerProps) {
  const hasPoint =
    latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Clique no mapa satélite para marcar o povoado. Arraste o pino para ajustar a posição.
      </Typography>
      <Box
        sx={{
          height,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <LeafletMap
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
          zoomControl
        >
          <TileLayer url={SATELLITE_TILE.url} attribution={SATELLITE_TILE.attribution} />
          <MapClickHandler onPick={onChange} />
          <MapViewController latitude={latitude} longitude={longitude} center={center} />
          {hasPoint && (
            <Marker
              position={[latitude!, longitude!]}
              icon={pickerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  onChange(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </LeafletMap>
      </Box>
      {hasPoint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
          Marcado em {latitude!.toFixed(5)}, {longitude!.toFixed(5)}
        </Typography>
      )}
    </Box>
  );
}
