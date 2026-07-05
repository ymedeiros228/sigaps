import type { Microarea } from '../services/api';

export type MicroareaSortMode = 'number' | 'name';

export function sortMicroareas(items: Microarea[], mode: MicroareaSortMode = 'number') {
  const rows = [...items];
  if (mode === 'name') {
    rows.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
    return rows;
  }
  rows.sort((a, b) => a.number - b.number || a.name.localeCompare(b.name, 'pt-BR'));
  return rows;
}
