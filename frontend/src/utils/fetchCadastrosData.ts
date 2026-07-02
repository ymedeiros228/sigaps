import type { CadastrosSummary } from '../services/api';
import {
  acsApi,
  cadastrosApi,
  microareasApi,
  municipalitiesApi,
  neighborhoodsApi,
  ubsApi,
} from '../services/api';
import { isAxiosError } from 'axios';

function summaryFromLists(
  ubs: unknown[],
  acs: Array<{ microarea?: unknown; status?: string }>,
  neighborhoods: unknown[],
  microareas: unknown[],
): CadastrosSummary {
  return {
    ubs: ubs.length,
    acs: acs.length,
    neighborhoods: neighborhoods.length,
    microareas: microareas.length,
    acsSemMicro: acs.filter((a) => !a.microarea).length,
    acsAtivos: acs.filter((a) => a.status === 'ATIVO').length,
  };
}

/** Resumo com fallback se o endpoint novo ainda não existir na API. */
export async function fetchCadastrosSummary(municipalityId: string): Promise<CadastrosSummary> {
  try {
    const res = await municipalitiesApi.cadastrosSummary(municipalityId);
    return res.data;
  } catch (error) {
    if (!isAxiosError(error) || (error.response?.status !== 404 && error.response?.status !== 405)) {
      throw error;
    }
    const [ubs, acs, neighborhoods, microareas] = await Promise.all([
      ubsApi.list(municipalityId).then((r) => r.data),
      acsApi.list(municipalityId).then((r) => r.data),
      neighborhoodsApi.list(municipalityId).then((r) => r.data),
      microareasApi.list(municipalityId).then((r) => r.data),
    ]);
    return summaryFromLists(ubs, acs, neighborhoods, microareas);
  }
}

/** Bundle com fallback para APIs antigas (produção sem redeploy). */
export async function fetchCadastrosBundle(municipalityId: string) {
  try {
    const res = await cadastrosApi.getBundle(municipalityId);
    return res.data;
  } catch (error) {
    if (!isAxiosError(error) || (error.response?.status !== 404 && error.response?.status !== 405)) {
      throw error;
    }
    const [municipality, summary, microareas, ubs, acs, neighborhoods] = await Promise.all([
      municipalitiesApi.get(municipalityId).then((r) => r.data),
      fetchCadastrosSummary(municipalityId),
      microareasApi.list(municipalityId).then((r) => r.data),
      ubsApi.list(municipalityId).then((r) => r.data),
      acsApi.list(municipalityId).then((r) => r.data),
      neighborhoodsApi.list(municipalityId).then((r) => r.data),
    ]);
    return { municipality, summary, microareas, ubs, acs, neighborhoods };
  }
}
