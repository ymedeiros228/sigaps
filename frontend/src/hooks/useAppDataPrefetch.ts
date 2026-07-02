import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useAppStore } from '../store';
import { prefetchCadastrosData, prefetchMapData } from '../utils/prefetchAppData';

/** Pré-carrega bundle de cadastros e dados do mapa após login. */
export function useAppDataPrefetch() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const userMunicipalityId = useAuthStore((s) => s.user?.municipalityId);
  const muniId = municipalityId ?? userMunicipalityId;

  useEffect(() => {
    if (!token || !muniId) return;
    prefetchCadastrosData(queryClient, muniId);
    void prefetchMapData(queryClient, muniId);
  }, [token, muniId, queryClient]);
}
