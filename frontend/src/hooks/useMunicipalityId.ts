import { useEffect } from 'react';
import { municipalitiesApi } from '../services/api';
import { useAppStore } from '../store';

export function useMunicipalityId() {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);

  useEffect(() => {
    if (municipalityId) return;
    municipalitiesApi.list().then((res) => {
      const muni = res.data[0];
      if (muni) setMunicipalityId(muni.id);
    });
  }, [municipalityId, setMunicipalityId]);

  return municipalityId;
}
