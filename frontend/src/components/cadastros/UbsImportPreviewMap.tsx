import { useEffect } from 'react';
import { Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Box, Typography } from '@mui/material';
import { LeafletMap } from '../map/LeafletMap';
import type { UbsImportRow } from '../../utils/parseUbsSpreadsheet';

const SATELLITE_TILE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri',
};

const previewIcon = L.divIcon({
  className: 'ubs-preview-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #1565C0;
    border: 2px solid #fff;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    box-shadow: 0 2px 8px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

function FitPreviewBounds({ rows }: { rows: UbsImportRow[] }) {
  const map = useMap();

  useEffect(() => {
    if (rows.length === 0) return;
    if (rows.length === 1) {
      map.setView([rows[0].latitude, rows[0].longitude], 14, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(rows.map((row) => [row.latitude, row.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15, animate: false });
  }, [rows, map]);

  return null;
}

type UbsImportPreviewMapProps = {
  rows: UbsImportRow[];
  center: { lat: number; lng: number };
  height?: number;
};

export function UbsImportPreviewMap({ rows, center, height = 280 }: UbsImportPreviewMapProps) {
  if (rows.length === 0) return null;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        Pré-visualização no mapa satélite — confira nomes e coordenadas antes de importar.
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
          <FitPreviewBounds rows={rows} />
          {rows.map((row, index) => (
            <Marker
              key={`${row.name}-${index}`}
              position={[row.latitude, row.longitude]}
              icon={previewIcon}
            >
              <Popup>
                <strong>{row.name}</strong>
                <br />
                {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                {row.address && (
                  <>
                    <br />
                    {row.address}
                  </>
                )}
              </Popup>
            </Marker>
          ))}
        </LeafletMap>
      </Box>
    </Box>
  );
}
