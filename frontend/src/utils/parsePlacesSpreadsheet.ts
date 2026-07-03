import type { PlaceKind } from '../services/api';
import { parseCoordNumber, parseCoordinatePair } from './parseCoordinates';

export type PlaceImportRow = {
  name: string;
  latitude: number;
  longitude: number;
  kind?: PlaceKind;
  ubsRef?: string;
  notes?: string;
};

function normHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

function pickColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function resolveCoordinates(
  latValue: unknown,
  lngValue: unknown,
  pairValue: unknown,
): { latitude: number; longitude: number } | null {
  const lat = parseCoordNumber(latValue);
  const lng = parseCoordNumber(lngValue);
  if (lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    return { latitude: lat, longitude: lng };
  }
  return parseCoordinatePair(String(pairValue ?? ''));
}

function parseKind(value: unknown): PlaceKind | undefined {
  const raw = normHeader(String(value ?? ''));
  if (!raw) return undefined;
  if (raw.includes('localidade')) return 'LOCALIDADE';
  if (raw.includes('distrito')) return 'DISTRITO';
  if (raw.includes('povoado') || raw.includes('vila') || raw.includes('lugarejo')) return 'POVOADO';
  return undefined;
}

function buildNotes(ubsRef?: string, notes?: string) {
  const parts: string[] = [];
  if (ubsRef?.trim()) parts.push(`UBS de referência: ${ubsRef.trim()}`);
  if (notes?.trim()) parts.push(notes.trim());
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function rowFromValues(values: {
  name: unknown;
  latitude?: unknown;
  longitude?: unknown;
  coordinates?: unknown;
  kind?: unknown;
  ubsRef?: unknown;
  notes?: unknown;
}): PlaceImportRow | null {
  const name = String(values.name ?? '').trim();
  if (!name) return null;

  const coords = resolveCoordinates(values.latitude, values.longitude, values.coordinates);
  if (!coords) return null;

  const ubsRef = String(values.ubsRef ?? '').trim() || undefined;
  const notesRaw = String(values.notes ?? '').trim() || undefined;

  return {
    name,
    latitude: coords.latitude,
    longitude: coords.longitude,
    kind: parseKind(values.kind) ?? 'POVOADO',
    ubsRef,
    notes: notesRaw,
  };
}

export function parsePlaceRowsFromObjects(rows: Record<string, unknown>[]): PlaceImportRow[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map(normHeader);
  const originalKeys = Object.keys(rows[0]);

  const nameIdx = pickColumn(headers, ['povoado', 'nome', 'localidade', 'lugar', 'place', 'name']);
  const latIdx = pickColumn(headers, ['latitude', 'lat']);
  const lngIdx = pickColumn(headers, ['longitude', 'lng', 'lon', 'long']);
  const coordsIdx = pickColumn(headers, ['coordenada', 'coordenadas', 'coordinates', 'coords']);
  const kindIdx = pickColumn(headers, ['tipo', 'kind', 'categoria']);
  const ubsIdx = pickColumn(headers, ['ubs', 'unidade', 'ubs_referencia', 'ubs referencia']);
  const notesIdx = pickColumn(headers, ['observacao', 'observacoes', 'notas', 'notes']);

  const get = (row: Record<string, unknown>, idx: number) =>
    idx >= 0 ? row[originalKeys[idx]] : undefined;

  return rows
    .map((row) =>
      rowFromValues({
        name: nameIdx >= 0 ? get(row, nameIdx) : row[originalKeys[0]],
        latitude: latIdx >= 0 ? get(row, latIdx) : undefined,
        longitude: lngIdx >= 0 ? get(row, lngIdx) : undefined,
        coordinates: coordsIdx >= 0 ? get(row, coordsIdx) : undefined,
        kind: kindIdx >= 0 ? get(row, kindIdx) : undefined,
        ubsRef: ubsIdx >= 0 ? get(row, ubsIdx) : undefined,
        notes: notesIdx >= 0 ? get(row, notesIdx) : undefined,
      }),
    )
    .filter((row): row is PlaceImportRow => row !== null);
}

export function parsePlacesCsvText(text: string): PlaceImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (lines.length === 0) return [];

  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((cell) => normHeader(cell.trim()));

  const nameIdx = pickColumn(headers, ['povoado', 'nome', 'localidade', 'lugar', 'place', 'name']);
  const latIdx = pickColumn(headers, ['latitude', 'lat']);
  const lngIdx = pickColumn(headers, ['longitude', 'lng', 'lon', 'long']);
  const coordsIdx = pickColumn(headers, ['coordenada', 'coordenadas', 'coordinates', 'coords']);
  const kindIdx = pickColumn(headers, ['tipo', 'kind', 'categoria']);
  const ubsIdx = pickColumn(headers, ['ubs', 'unidade', 'ubs_referencia', 'ubs referencia']);
  const notesIdx = pickColumn(headers, ['observacao', 'observacoes', 'notas', 'notes']);

  const dataLines = nameIdx >= 0 || latIdx >= 0 || coordsIdx >= 0 ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      return rowFromValues({
        name: parts[nameIdx >= 0 ? nameIdx : 0],
        latitude: latIdx >= 0 ? parts[latIdx] : undefined,
        longitude: lngIdx >= 0 ? parts[lngIdx] : undefined,
        coordinates: coordsIdx >= 0 ? parts[coordsIdx] : undefined,
        kind: kindIdx >= 0 ? parts[kindIdx] : undefined,
        ubsRef: ubsIdx >= 0 ? parts[ubsIdx] : undefined,
        notes: notesIdx >= 0 ? parts[notesIdx] : undefined,
      });
    })
    .filter((row): row is PlaceImportRow => row !== null);
}

export async function parsePlacesExcelFile(file: File): Promise<PlaceImportRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return parsePlaceRowsFromObjects(rows);
}

export async function downloadPlacesImportTemplateXlsx() {
  const XLSX = await import('xlsx');
  const rows = [
    {
      povoado: 'Bacabinha',
      ubs: 'UBS Centro',
      latitude: -6.215,
      longitude: -43.81,
      tipo: 'POVOADO',
      observacoes: 'Comunidade rural',
    },
    {
      povoado: 'Lagoa Seca',
      ubs: 'UBS Rural',
      latitude: -6.195,
      longitude: -43.765,
      tipo: 'POVOADO',
      observacoes: '',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Povoados');
  XLSX.writeFile(workbook, 'modelo-povoados-sigaps.xlsx');
}

export const PLACES_CSV_TEMPLATE = `povoado;ubs;latitude;longitude;tipo;observacoes
Bacabinha;UBS Centro;-6.21500;-43.81000;POVOADO;Comunidade rural
Lagoa Seca;UBS Rural;-6.19500;-43.76500;POVOADO;`;

export function splitPlaceNotes(notes?: string | null) {
  if (!notes) return { ubsRef: '', notes: '' };
  const match = notes.match(/^UBS de referência:\s*(.+?)(?:\n|$)/i);
  if (!match) return { ubsRef: '', notes: notes.trim() };
  const ubsRef = match[1].trim();
  const rest = notes.replace(match[0], '').trim();
  return { ubsRef, notes: rest };
}

export function mergePlaceNotes(ubsRef: string, notes: string) {
  return buildNotes(ubsRef, notes) ?? '';
}
