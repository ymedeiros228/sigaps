import { digitsOnly } from './inputMasks';

export type AcsImportRow = {
  name: string;
  cpf?: string;
  phone?: string;
  microareaRef?: string;
  status?: string;
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

function normalizeStatus(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return 'ATIVO';
  return raw === 'INATIVO' ? 'INATIVO' : 'ATIVO';
}

function rowFromValues(values: {
  name: unknown;
  cpf?: unknown;
  phone?: unknown;
  microareaRef?: unknown;
  status?: unknown;
}): AcsImportRow | null {
  const name = String(values.name ?? '').trim();
  if (!name) return null;

  const cpf = digitsOnly(String(values.cpf ?? ''));
  if (cpf && cpf.length !== 11) return null;

  const phone = String(values.phone ?? '').trim();
  const microareaRef = String(values.microareaRef ?? '').trim();

  return {
    name,
    cpf: cpf || undefined,
    phone: phone || undefined,
    microareaRef: microareaRef || undefined,
    status: normalizeStatus(values.status),
  };
}

export function parseAcsRowsFromObjects(rows: Record<string, unknown>[]): AcsImportRow[] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]).map(normHeader);
  const originalKeys = Object.keys(rows[0]);

  const nameIdx = pickColumn(headers, [
    'nome do acs',
    'nome do agente comunitario de saude',
    'nome do agente comunitario',
    'nome',
    'agente comunitario',
  ]);
  const cpfIdx = pickColumn(headers, ['cpf']);
  const phoneIdx = pickColumn(headers, ['telefone', 'phone', 'celular', 'contato']);
  const microIdx = pickColumn(headers, ['microarea', 'micro area', 'microarea', 'mic area', 'micarea']);
  const statusIdx = pickColumn(headers, ['status', 'situacao']);

  const get = (row: Record<string, unknown>, idx: number) =>
    idx >= 0 ? row[originalKeys[idx]] : undefined;

  return rows
    .map((row) =>
      rowFromValues({
        name: nameIdx >= 0 ? get(row, nameIdx) : row[originalKeys[0]],
        cpf: cpfIdx >= 0 ? get(row, cpfIdx) : undefined,
        phone: phoneIdx >= 0 ? get(row, phoneIdx) : undefined,
        microareaRef: microIdx >= 0 ? get(row, microIdx) : undefined,
        status: statusIdx >= 0 ? get(row, statusIdx) : undefined,
      }),
    )
    .filter((row): row is AcsImportRow => row !== null);
}

export function parseAcsCsvText(text: string): AcsImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (lines.length === 0) return [];

  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map((cell) => normHeader(cell.trim()));

  const nameIdx = pickColumn(headers, [
    'nome do acs',
    'nome do agente comunitario de saude',
    'nome do agente comunitario',
    'nome',
    'agente comunitario',
  ]);
  const cpfIdx = pickColumn(headers, ['cpf']);
  const phoneIdx = pickColumn(headers, ['telefone', 'phone', 'celular', 'contato']);
  const microIdx = pickColumn(headers, ['microarea', 'micro area', 'mic area', 'micarea']);
  const statusIdx = pickColumn(headers, ['status', 'situacao']);

  const dataLines = nameIdx >= 0 || cpfIdx >= 0 ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.split(sep).map((cell) => cell.trim().replace(/^"|"$/g, ''));
      return rowFromValues({
        name: parts[nameIdx >= 0 ? nameIdx : 0],
        cpf: cpfIdx >= 0 ? parts[cpfIdx] : undefined,
        phone: phoneIdx >= 0 ? parts[phoneIdx] : undefined,
        microareaRef: microIdx >= 0 ? parts[microIdx] : undefined,
        status: statusIdx >= 0 ? parts[statusIdx] : undefined,
      });
    })
    .filter((row): row is AcsImportRow => row !== null);
}

export async function parseAcsExcelFile(file: File): Promise<AcsImportRow[]> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return parseAcsRowsFromObjects(rows);
}
