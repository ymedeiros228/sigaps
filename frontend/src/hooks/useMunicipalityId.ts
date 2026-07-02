import { useEffect } from 'react';
import { ACTIVE_MUNICIPALITY_KEY, useAppStore, useAuthStore } from '../store';

function readPersistedMunicipalityId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_MUNICIPALITY_KEY);
  } catch {
    return null;
  }
}

export function useMunicipalityId(): string | null {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const user = useAuthStore((s) => s.user);
  const userMunicipalityId = user?.municipalityId ?? null;

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
    }
  }, [municipalityId, user?.role, userMunicipalityId, setMunicipalityId]);

  const persistedAdminId =
    user?.role === 'ADMINISTRADOR' ? readPersistedMunicipalityId() : null;

  return municipalityId ?? userMunicipalityId ?? persistedAdminId ?? null;
}
