import type { Place } from '../services/api';

export type PlaceSortMode = 'number' | 'name';

export function sortPlaces(items: Place[], mode: PlaceSortMode = 'number') {
  const rows = [...items];
  if (mode === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    return rows;
  }
  rows.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
  });
  return rows;
}
