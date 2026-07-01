import { useEffect } from 'react';
import { municipalitiesApi } from '../services/api';
import { useAppStore, useAuthStore } from '../store';
import { waitForApiReady } from '../utils/waitForApi';

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

    let cancelled = false;

    void (async () => {
      await waitForApiReady(8, 4000);
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const res = await municipalitiesApi.list();
          const muni = res.data[0];
          if (muni) setMunicipalityId(muni.id);
          break;
        } catch {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [municipalityId, userMunicipalityId, setMunicipalityId]);

  return municipalityId ?? userMunicipalityId ?? null;
}
