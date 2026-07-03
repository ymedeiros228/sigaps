import { parseCoordNumber, parseCoordinatePair } from './parseCoordinates';

export type UbsImportRow = {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  phone?: string;
  coordinator?: string;
  cnesCode?: string;
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

function digitsCnes(value: unknown) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 7 ? digits : undefined;
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
  const pair = parseCoordinatePair(String(pairValue ?? ''));
  return pair;
}

function rowFromValues(values: {
  name: unknown;
  address?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  coordinates?: unknown;
  phone?: unknown;
  coordinator?: unknown;
  cnesCode?: unknown;
}): UbsImportRow | null {
  const name = String(values.name ?? '').trim();
  if (!name) return null;

  const coords = resolveCoordinates(values.latitude, values.longitude, values.coordinates);
  if (!coords) return null;

  const address = String(values.address ?? '').trim();
  const phone = String(values.phone ?? '').trim();
  const coordinator = String(values.coordinator ?? '').trim();

  return {
    name,
    address: address || undefined,
    latitude: coords.latitude,
    longitude: coords.longitude,
    phone: phone || undefined,
    coordinator: coordinator || undefined,
    cnesCode: digitsCnes(values.cnesCode),
  };
}

export function parseUbsRowsFromObjects(rows: Record<string, unknown>[]): UbsImportRow[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map(normHeader);
  const originalKeys = Object.keys(rows[0]);

  const nameIdx = pickColumn(headers, ['nome', 'name', 'unidade', 'ubs', 'local']);
  const addressIdx = pickColumn(headers, ['endereco', 'address', 'logradouro', 'observacao', 'origem']);
  const latIdx = pickColumn(headers, ['latitude', 'lat']);
  const lngIdx = pickColumn(headers, ['longitude', 'lng', 'lon', 'long']);
  const coordsIdx = pickColumn(headers, ['coordenada', 'coordenadas', 'coordinates', 'coords']);
  const phoneIdx = pickColumn(headers, ['telefone', 'phone', 'fone', 'celular']);
  const coordinatorIdx = pickColumn(headers, ['coordenador', 'coordinator', 'responsavel']);
  const cnesIdx = pickColumn(headers, ['cnes', 'codigo cnes', 'cod_cnes']);

  const get = (row: Record<string, unknown>, idx: number) =>
    idx >= 0 ? row[originalKeys[idx]] : undefined;

  return rows
    .map((row) =>
      rowFromValues({
        name: nameIdx >= 0 ? get(row, nameIdx) : row[originalKeys[0]],
        address: addressIdx >= 0 ? get(row, addressIdx) : undefined,
        latitude: latIdx >= 0 ? get(row, latIdx) : undefined,
        longitude: lngIdx >= 0 ? get(row, lngIdx) : undefined,
        coordinates: coordsIdx >= 0 ? get(row, coordsIdx) : undefined,
        phone: phoneIdx >= 0 ? get(row, phoneIdx) : undefined,
        coordinator: coordinatorIdx >= 0 ? get(row, coordinatorIdx) : undefined,
        cnesCode: cnesIdx >= 0 ? get(row, cnesIdx) : undefined,
      }),
    )
    .filter((row): row is UbsImportRow => row !== null);
}

export function parseUbsCsvText(text: string): UbsImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (lines.length === 0) return [];

  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((cell) => normHeader(cell.trim()));

  const nameIdx = pickColumn(headers, ['nome', 'name', 'unidade', 'ubs', 'local']);
  const addressIdx = pickColumn(headers, ['endereco', 'address', 'logradouro', 'observacao', 'origem']);
  const latIdx = pickColumn(headers, ['latitude', 'lat']);
  const lngIdx = pickColumn(headers, ['longitude', 'lng', 'lon', 'long']);
  const coordsIdx = pickColumn(headers, ['coordenada', 'coordenadas', 'coordinates', 'coords']);
  const phoneIdx = pickColumn(headers, ['telefone', 'phone', 'fone', 'celular']);
  const coordinatorIdx = pickColumn(headers, ['coordenador', 'coordinator', 'responsavel']);
  const cnesIdx = pickColumn(headers, ['cnes', 'codigo cnes', 'cod_cnes']);

  const dataLines = nameIdx >= 0 || latIdx >= 0 || coordsIdx >= 0 ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      return rowFromValues({
        name: parts[nameIdx >= 0 ? nameIdx : 0],
        address: addressIdx >= 0 ? parts[addressIdx] : undefined,
        latitude: latIdx >= 0 ? parts[latIdx] : undefined,
        longitude: lngIdx >= 0 ? parts[lngIdx] : undefined,
        coordinates: coordsIdx >= 0 ? parts[coordsIdx] : undefined,
        phone: phoneIdx >= 0 ? parts[phoneIdx] : undefined,
        coordinator: coordinatorIdx >= 0 ? parts[coordinatorIdx] : undefined,
        cnesCode: cnesIdx >= 0 ? parts[cnesIdx] : undefined,
      });
    })
    .filter((row): row is UbsImportRow => row !== null);
}

export async function parseUbsExcelFile(file: File): Promise<UbsImportRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return parseUbsRowsFromObjects(rows);
}

export async function downloadUbsImportTemplateXlsx() {
  const XLSX = await import('xlsx');
  const rows = [
    {
      nome: 'UBS Centro',
      endereco: 'Rua Principal, 100',
      latitude: -6.1828,
      longitude: -43.7869,
      telefone: '98999998888',
      coordenador: 'Maria Silva',
      cnes: '2345678',
    },
    {
      nome: 'UBS Rural',
      endereco: 'Povoado Bacabinha',
      latitude: -6.215,
      longitude: -43.81,
      telefone: '',
      coordenador: '',
      cnes: '',
    },
  ];
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'UBS');
  XLSX.writeFile(workbook, 'modelo-ubs-sigaps.xlsx');
}

export const UBS_CSV_TEMPLATE = `nome;endereco;latitude;longitude;telefone;coordenador;cnes
UBS Centro;Rua Principal, 100;-6.18280;-43.78690;98999998888;Maria Silva;2345678
UBS Rural;Povoado Bacabinha;-6.21500;-43.81000;;;`;
