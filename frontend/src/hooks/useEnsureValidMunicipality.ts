import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { municipalitiesApi } from '../services/api';
import { useAppStore, useAuthStore } from '../store';
import { canAccessAdmin } from '../utils/permissions';

/** Corrige município ativo inválido (ex.: localStorage antigo após reset do banco). */
export function useEnsureValidMunicipality() {
  const user = useAuthStore((s) => s.user);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);

  const { data: municipalities = [] } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => municipalitiesApi.list().then((r) => r.data),
    enabled: !!user && !user.municipalityId && canAccessAdmin(user.role),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!user) return;

    // Cada conta trabalha no próprio mapa (inclusive administrador).
    if (user.municipalityId) {
      if (municipalityId !== user.municipalityId) setMunicipalityId(user.municipalityId);
      return;
    }
    if (!canAccessAdmin(user.role)) return;

    if (!municipalities.length) return;

    const isValid = municipalityId && municipalities.some((m) => m.id === municipalityId);
    if (isValid) return;

    if (municipalities[0]) setMunicipalityId(municipalities[0].id);
  }, [user, municipalities, municipalityId, setMunicipalityId]);
}
