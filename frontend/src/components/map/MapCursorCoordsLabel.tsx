import { useEffect, useState } from 'react';
import { Typography, type TypographyProps } from '@mui/material';
import { getMapCursorCoords, subscribeMapCursorCoords } from '../../utils/mapCursorCoordsStore';

type MapCursorCoordsLabelProps = {
  emptyText?: string;
  typographyProps?: TypographyProps;
};

/** Só este label re-renderiza no mousemove — o mapa inteiro fica estável. */
export function MapCursorCoordsLabel({
  emptyText = 'Passe o mouse no mapa',
  typographyProps,
}: MapCursorCoordsLabelProps) {
  const [coords, setCoords] = useState(getMapCursorCoords);

  useEffect(() => subscribeMapCursorCoords((lat, lng) => setCoords({ lat, lng })), []);

  const hasCoords =
    coords.lat != null &&
    coords.lng != null &&
    Number.isFinite(coords.lat) &&
    Number.isFinite(coords.lng);

  if (!hasCoords && !emptyText) return null;

  return (
    <Typography
      variant="caption"
      component="span"
      {...typographyProps}
      sx={{
        fontFamily: 'monospace',
        fontWeight: 700,
        letterSpacing: 0.2,
        ...typographyProps?.sx,
      }}
    >
      {hasCoords ? `${coords.lat!.toFixed(5)}, ${coords.lng!.toFixed(5)}` : emptyText}
    </Typography>
  );
}
