import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAcsExcelFile } from './parseAcsSpreadsheet';
import { parsePlacesExcelFile } from './parsePlacesSpreadsheet';
import { parseUbsExcelFile } from './parseUbsSpreadsheet';

/** Monta um .xlsx de verdade na memória, como o Excel salvaria. */
function planilha(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Planilha');
  const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new File([data], 'planilha.xlsx');
}

describe('importação de planilha .xlsx', () => {
  it('lê as UBS do modelo, com coordenada em número ou com vírgula, e descarta a linha sem GPS', async () => {
    const file = planilha([
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
        latitude: '-6,215',
        longitude: '-43,81',
        telefone: '',
        coordenador: '',
        cnes: '123',
      },
      { nome: 'UBS sem GPS', endereco: '', latitude: '', longitude: '', telefone: '', coordenador: '', cnes: '' },
    ]);

    await expect(parseUbsExcelFile(file)).resolves.toEqual([
      {
        name: 'UBS Centro',
        address: 'Rua Principal, 100',
        latitude: -6.1828,
        longitude: -43.7869,
        phone: '98999998888',
        coordinator: 'Maria Silva',
        cnesCode: '2345678',
      },
      { name: 'UBS Rural', address: 'Povoado Bacabinha', latitude: -6.215, longitude: -43.81 },
    ]);
  });

  it('lê os povoados do modelo e entende o tipo escrito de qualquer jeito', async () => {
    const file = planilha([
      {
        povoado: 'Bacabinha',
        ubs: 'UBS Centro',
        latitude: -6.215,
        longitude: -43.81,
        tipo: 'POVOADO',
        observacoes: 'Comunidade rural',
      },
      { povoado: 'Lagoa Seca', ubs: '', latitude: -6.195, longitude: -43.765, tipo: 'Distrito', observacoes: '' },
      { povoado: 'Sem tipo', ubs: '', latitude: -6.2, longitude: -43.7, tipo: '', observacoes: '' },
    ]);

    await expect(parsePlacesExcelFile(file)).resolves.toEqual([
      {
        name: 'Bacabinha',
        latitude: -6.215,
        longitude: -43.81,
        kind: 'POVOADO',
        ubsRef: 'UBS Centro',
        notes: 'Comunidade rural',
      },
      { name: 'Lagoa Seca', latitude: -6.195, longitude: -43.765, kind: 'DISTRITO' },
      { name: 'Sem tipo', latitude: -6.2, longitude: -43.7, kind: 'POVOADO' },
    ]);
  });

  it('lê os ACS: limpa o CPF, descarta CPF incompleto e normaliza o status', async () => {
    const file = planilha([
      {
        'Nome do ACS': 'Maria Silva',
        CPF: '123.456.789-01',
        Contato: '(99) 98421-7828',
        'Ruas atendidas': 'Rua do Sol',
        Status: 'inativo',
      },
      { 'Nome do ACS': 'João Santos', CPF: '', Contato: '', 'Ruas atendidas': '', Status: '' },
      { 'Nome do ACS': 'CPF incompleto', CPF: '123', Contato: '', 'Ruas atendidas': '', Status: '' },
    ]);

    await expect(parseAcsExcelFile(file)).resolves.toEqual([
      {
        name: 'Maria Silva',
        cpf: '12345678901',
        phone: '(99) 98421-7828',
        streetCoverageText: 'Rua do Sol',
        status: 'INATIVO',
      },
      { name: 'João Santos', status: 'ATIVO' },
    ]);
  });

  it('planilha vazia não quebra', async () => {
    await expect(parseUbsExcelFile(planilha([]))).resolves.toEqual([]);
  });
});
