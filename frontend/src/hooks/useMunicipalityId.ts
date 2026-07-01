import { useEffect } from 'react';
import { municipalitiesApi } from '../services/api';
import { useAppStore, useAuthStore } from '../store';

export function useMunicipalityId() {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const userMunicipalityId = useAuthStore((s) => s.user?.municipalityId);

  useEffect(() => {
    if (municipalityId) return;
    if (userMunicipalityId) {
      setMunicipalityId(userMunicipalityId);
      return;
    }
    municipalitiesApi.list().then((res) => {
      const muni = res.data[0];
      if (muni) setMunicipalityId(muni.id);
    });
  }, [municipalityId, userMunicipalityId, setMunicipalityId]);

  return municipalityId ?? userMunicipalityId ?? null;
}
