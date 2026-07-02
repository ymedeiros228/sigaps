import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { municipalitiesApi } from '../services/api';
import { ACTIVE_MUNICIPALITY_KEY, useAppStore, useAuthStore } from '../store';
import { cadastrosQueryDefaults } from '../utils/cadastrosQuery';
import { waitForApiReady } from '../utils/waitForApi';

function readPersistedMunicipalityId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_MUNICIPALITY_KEY);
  } catch {
    return null;
  }
}

type BootstrapState = {
  municipalityId: string | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
};

/** Garante ID de município válido antes de montar abas de cadastro. */
export function useMunicipalityBootstrap(): BootstrapState {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const userMunicipalityId = user?.municipalityId ?? null;

  useEffect(() => {
    if (municipalityId) return;
    if (!isAdmin && userMunicipalityId) {
      setMunicipalityId(userMunicipalityId);
      return;
    }
    const persisted = isAdmin ? readPersistedMunicipalityId() : null;
    if (persisted) {
      setMunicipalityId(persisted);
      return;
    }
    if (userMunicipalityId) {
      setMunicipalityId(userMunicipalityId);
    }
  }, [municipalityId, isAdmin, userMunicipalityId, setMunicipalityId]);

  const needsList = !!user && !municipalityId;

  const {
    data: municipalities = [],
    isLoading: listLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['municipalities', 'bootstrap'],
    queryFn: async () => {
      await waitForApiReady(8, 2500);
      return municipalitiesApi.list().then((r) => r.data);
    },
    enabled: needsList,
    ...cadastrosQueryDefaults,
  });

  useEffect(() => {
    if (!needsList || municipalities.length === 0) return;

    const persisted = isAdmin ? readPersistedMunicipalityId() : null;
    const validPersisted =
      persisted && municipalities.some((m) => m.id === persisted) ? persisted : null;
    const fromUser =
      userMunicipalityId && municipalities.some((m) => m.id === userMunicipalityId)
        ? userMunicipalityId
        : null;

    setMunicipalityId(validPersisted ?? fromUser ?? municipalities[0]!.id);
  }, [needsList, municipalities, isAdmin, userMunicipalityId, setMunicipalityId]);

  const resolvedId = useMemo(() => {
    if (municipalityId) return municipalityId;
    if (!isAdmin && userMunicipalityId) return userMunicipalityId;
    if (isAdmin) {
      const persisted = readPersistedMunicipalityId();
      if (persisted) return persisted;
    }
    return userMunicipalityId;
  }, [municipalityId, isAdmin, userMunicipalityId]);

  const isLoading = !!user && !resolvedId && (listLoading || isFetching || needsList);

  return {
    municipalityId: resolvedId,
    isLoading,
    error: isError ? (error as Error) : null,
    retry: () => void refetch(),
  };
}
