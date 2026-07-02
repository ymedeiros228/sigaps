import { streetsApi, type Street } from '../services/api';

const PAGE_SIZE = 5000;

/** Carrega todas as páginas de ruas (mapOnly) — páginas extras em paralelo. */
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
  if (totalPages <= 1) {
    return { items, total: data.total };
  }

  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
  const rest = await Promise.all(
    pageNumbers.map((page) =>
      streetsApi.list(municipalityId, {
        limit: PAGE_SIZE,
        mapOnly: true,
        page,
        geoPrecision: 4,
      }),
    ),
  );
  for (const res of rest) {
    items.push(...res.data.items);
  }

  return { items, total: data.total };
}
