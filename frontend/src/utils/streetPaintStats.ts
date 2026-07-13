import type { Street } from '../services/api';
import { streetHasPaint } from './streetPaintSegments';

/** Rua vinculada à microárea (rua inteira ou algum trecho/lado). */
export function streetBelongsToMicroarea(street: Street, microareaId: string): boolean {
  if (street.microareaId === microareaId) return true;
  return (street.paintSegments ?? []).some((seg) => seg.microareaId === microareaId);
}

export function countStreetsForMicroarea(streets: Street[], microareaId: string): number {
  return streets.filter((s) => streetBelongsToMicroarea(s, microareaId)).length;
}

export function countPaintedStreets(streets: Street[]): number {
  return streets.filter(streetHasPaint).length;
}

export function microareaIdsOnStreet(street: Street): string[] {
  const ids = new Set<string>();
  if (street.microareaId) ids.add(street.microareaId);
  for (const seg of street.paintSegments ?? []) {
    ids.add(seg.microareaId);
  }
  return Array.from(ids);
}

export function sumFamiliesForMicroarea(streets: Street[], microareaId: string): number {
  let total = 0;
  for (const street of streets) {
    if (streetBelongsToMicroarea(street, microareaId)) {
      total += street.familyCount ?? 0;
    }
  }
  return total;
}

export function countStreetsWithFamilyData(streets: Street[]): number {
  return streets.filter((s) => (s.familyCount ?? 0) > 0).length;
}

export function sumFamiliesOnStreets(streets: Street[]): number {
  return streets.reduce((sum, s) => sum + (s.familyCount ?? 0), 0);
}
