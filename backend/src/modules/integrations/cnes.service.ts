import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export type CnesLookupResult = {
  cnesCode: string;
  name: string;
  address: string;
  municipality: string;
  uf: string;
  phone?: string;
  active: boolean;
  source: 'api' | 'format-only';
};

@Injectable()
export class CnesService {
  private readonly logger = new Logger(CnesService.name);

  normalizeCode(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 7) {
      throw new BadRequestException('CNES deve ter 7 dígitos.');
    }
    return digits;
  }

  async lookup(cnesCode: string): Promise<CnesLookupResult> {
    const code = this.normalizeCode(cnesCode);
    const apiUrl = `https://apidadosabertos.saude.gov.br/cnes/estabelecimentos/${code}`;

    try {
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as Record<string, unknown>;
      const nome =
        String(data.nome_fantasia ?? data.no_fantasia ?? data.nome ?? data.razao_social ?? '').trim();
      const municipio = String(data.nome_municipio ?? data.municipio ?? '').trim();
      const uf = String(data.sigla_uf ?? data.uf ?? '').trim();
      const logradouro = String(data.endereco ?? data.logradouro ?? data.no_logradouro ?? '').trim();
      const numero = String(data.numero ?? data.nu_numero ?? '').trim();
      const bairro = String(data.bairro ?? data.no_bairro ?? '').trim();
      const address = [logradouro, numero, bairro].filter(Boolean).join(', ') || 'Endereço não informado';
      const telefone = String(data.telefone ?? data.nu_telefone ?? '').trim() || undefined;
      const status = data.status ?? data.situacao;

      return {
        cnesCode: code,
        name: nome || `Estabelecimento CNES ${code}`,
        address,
        municipality: municipio,
        uf,
        phone: telefone,
        active: status === 1 || status === '1' || status === true || status === 'ATIVO',
        source: 'api',
      };
    } catch (error) {
      this.logger.warn(`Falha na consulta CNES ${code}: ${(error as Error).message}`);
      return {
        cnesCode: code,
        name: `CNES ${code}`,
        address: '',
        municipality: '',
        uf: '',
        active: true,
        source: 'format-only',
      };
    }
  }
}
