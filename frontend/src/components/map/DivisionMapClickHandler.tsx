import { useMapEvents } from 'react-leaflet';
import { useMapStore } from '../../store';

export function DivisionMapClickHandler() {
  const divisionMode = useMapStore((s) => s.divisionMode);
  const setDivisionDraft = useMapStore((s) => s.setDivisionDraft);
  const draft = useMapStore((s) => s.divisionDraft);

  useMapEvents({
    click(e) {
      if (!divisionMode) return;
      const { lat, lng } = e.latlng;
      setDivisionDraft({
        lat,
        lng,
        radiusMeters: draft?.radiusMeters ?? 400,
        name: draft?.name ?? '',
      });
    },
  });

  return null;
}
