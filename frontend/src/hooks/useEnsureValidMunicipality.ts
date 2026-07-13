import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { municipalitiesApi } from '../services/api';
import { useAppStore, useAuthStore } from '../store';
import { canAccessAdmin } from '../utils/permissions';
import { queryKeys } from '../utils/queryKeys';

/** Corrige município ativo inválido (ex.: localStorage antigo após reset do banco). */
export function useEnsureValidMunicipality() {
  const user = useAuthStore((s) => s.user);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);

  const { data: municipalities = [] } = useQuery({
    queryKey: queryKeys.municipalities,
    queryFn: () => municipalitiesApi.list().then((r) => r.data),
    enabled: !!user && canAccessAdmin(user.role),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;

    if (!canAccessAdmin(user.role)) {
      if (user.municipalityId && municipalityId !== user.municipalityId) {
        setMunicipalityId(user.municipalityId);
      }
      return;
    }

    if (!municipalities.length) return;

    const isValid = municipalityId && municipalities.some((m) => m.id === municipalityId);
    if (isValid) return;

    const fallback =
      municipalities.find((m) => m.id === user.municipalityId) ?? municipalities[0];
    if (fallback) setMunicipalityId(fallback.id);
  }, [user, municipalities, municipalityId, setMunicipalityId]);
}
