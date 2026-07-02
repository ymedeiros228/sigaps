import type { QueryClient } from '@tanstack/react-query';
import type {
  Acs,
  CadastrosSummary,
  Microarea,
  Municipality,
  Neighborhood,
  Ubs,
} from '../services/api';
import { queryKeys } from './queryKeys';

export type CadastrosBundle = {
  municipality: Municipality;
  summary: CadastrosSummary;
  microareas: Microarea[];
  ubs: Ubs[];
  acs: Acs[];
  neighborhoods: Neighborhood[];
};

export function hydrateCadastrosCache(
  queryClient: QueryClient,
  municipalityId: string,
  bundle: CadastrosBundle,
) {
  queryClient.setQueryData(queryKeys.cadastrosBundle(municipalityId), bundle);
  queryClient.setQueryData(queryKeys.municipality(municipalityId), bundle.municipality);
  queryClient.setQueryData(queryKeys.cadastrosSummary(municipalityId), bundle.summary);
  queryClient.setQueryData(queryKeys.microareas(municipalityId), bundle.microareas);
  queryClient.setQueryData(queryKeys.ubs(municipalityId), bundle.ubs);
  queryClient.setQueryData(queryKeys.acs(municipalityId), bundle.acs);
  queryClient.setQueryData(queryKeys.neighborhoods(municipalityId), bundle.neighborhoods);
}

export function invalidateCadastrosCache(queryClient: QueryClient, municipalityId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.cadastrosBundle(municipalityId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.municipality(municipalityId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.cadastrosSummary(municipalityId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.microareas(municipalityId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.ubs(municipalityId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.acs(municipalityId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.neighborhoods(municipalityId) });
}
