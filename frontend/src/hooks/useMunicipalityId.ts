import { useEffect } from 'react';
import { municipalitiesApi } from '../services/api';
import { ACTIVE_MUNICIPALITY_KEY, useAppStore, useAuthStore } from '../store';
import { waitForApiReady } from '../utils/waitForApi';

function readPersistedMunicipalityId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_MUNICIPALITY_KEY);
  } catch {
    return null;
  }
}

export function useMunicipalityId() {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const user = useAuthStore((s) => s.user);
  const userMunicipalityId = user?.municipalityId;

  useEffect(() => {
    if (municipalityId) return;

    if (user?.role === 'ADMINISTRADOR') {
      const persisted = readPersistedMunicipalityId();
      if (persisted) {
        setMunicipalityId(persisted);
        return;
      }
    }

    if (userMunicipalityId) {
      setMunicipalityId(userMunicipalityId);
      return;
    }

    let cancelled = false;

    void (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          const res = await municipalitiesApi.list();
          const muni = res.data[0];
          if (muni) setMunicipalityId(muni.id);
          return;
        } catch {
          if (attempt < 3) {
            await waitForApiReady(3, 2000);
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [municipalityId, user?.role, userMunicipalityId, setMunicipalityId]);

  const persistedAdminId =
    user?.role === 'ADMINISTRADOR' ? readPersistedMunicipalityId() : null;

  return municipalityId ?? userMunicipalityId ?? persistedAdminId ?? null;
}
