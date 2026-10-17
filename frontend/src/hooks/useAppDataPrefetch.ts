import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useAppStore } from '../store';
import { prefetchCadastrosData, prefetchMapData } from '../utils/prefetchAppData';
import { isAcsUser } from '../utils/permissions';

/**
 * Pré-carrega os dados depois do login (roda no AppLayout, que monta logo após
 * entrar, então cobre o login normal e o automático do dev).
 *
 * O ACS só vê o mapa da própria microárea e a Ajuda: não usa a tela de
 * Cadastros, então não baixa o pacote de cadastros (UBS, ACS, bairros,
 * microáreas e resumo). O que o mapa precisa vem pelo prefetchMapData.
 */
export function useAppDataPrefetch() {
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const userMunicipalityId = useAuthStore((s) => s.user?.municipalityId);
  const muniId = municipalityId ?? userMunicipalityId;

  useEffect(() => {
    if (!token || !muniId) return;
    if (!isAcsUser(role)) prefetchCadastrosData(queryClient, muniId);
    void prefetchMapData(queryClient, muniId);
  }, [token, role, muniId, queryClient]);
}
