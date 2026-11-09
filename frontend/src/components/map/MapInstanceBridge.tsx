import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { getCurrentLeafletMap, setCurrentLeafletMap } from '../../utils/mapInstance';

/** Registra o mapa principal para a foto do PDF (ver utils/mapInstance). */
export function MapInstanceBridge() {
  const map = useMap();
  useEffect(() => {
    setCurrentLeafletMap(map);
    return () => {
      if (getCurrentLeafletMap() === map) setCurrentLeafletMap(null);
    };
  }, [map]);
  return null;
}
