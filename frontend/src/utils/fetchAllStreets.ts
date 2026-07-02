import { streetsApi, type Street } from '../services/api';

const PAGE_SIZE = 2000;

/** Carrega todas as páginas de ruas (mapOnly) para municípios com malha grande. */
export async function fetchAllMapStreets(municipalityId: string): Promise<{
  items: Street[];
  total: number;
}> {
  const first = await streetsApi.list(municipalityId, {
    limit: PAGE_SIZE,
    mapOnly: true,
    page: 1,
    geoPrecision: 4,
  });
  const data = first.data;
  const items = [...data.items];

  const totalPages = (data as { totalPages?: number }).totalPages ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const res = await streetsApi.list(municipalityId, {
      limit: PAGE_SIZE,
      mapOnly: true,
      page,
      geoPrecision: 4,
    });
    items.push(...res.data.items);
  }

  return { items, total: data.total };
}
