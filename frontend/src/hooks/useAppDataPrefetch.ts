import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useAppStore } from '../store';
import { prefetchCadastrosData, prefetchMapData } from '../utils/prefetchAppData';
import { waitForApiReady } from '../utils/waitForApi';

/** Pré-carrega dados do mapa e dashboard quando o usuário já está logado. */
export function useAppDataPrefetch() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const userMunicipalityId = useAuthStore((s) => s.user?.municipalityId);
  const muniId = municipalityId ?? userMunicipalityId;

  useEffect(() => {
    if (!token || !muniId) return;
    void (async () => {
      await waitForApiReady(6, 3000);
      prefetchCadastrosData(queryClient, muniId);
      void prefetchMapData(queryClient, muniId);
    })();
  }, [token, muniId, queryClient]);
}
