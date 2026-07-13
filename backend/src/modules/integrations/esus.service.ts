import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { invalidateDashboardIndicators } from '../../common/utils/dashboard-cache.util';
import {
  buildStreetRefCatalog,
  matchStreetRef,
} from '../acs/acs-street-coverage.util';

type EsusRow = {
  streetRef: string;
  familyCount: number;
  inhabitantCount: number;
};

@Injectable()
export class EsusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Aceita CSV e-SUS piloto com aliases de colunas comuns. */
  parseCsv(content: string): EsusRow[] {
    const lines = content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new BadRequestException('Planilha vazia ou sem cabeçalho.');
    }

    const header = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
    const streetIdx = header.findIndex((h) =>
      ['rua', 'logradouro', 'no_logradouro', 'ds_logradouro', 'endereco', 'street'].includes(h),
    );
    const familyIdx = header.findIndex((h) =>
      ['familias', 'família', 'familia', 'qt_familia', 'nu_familias', 'family_count'].includes(h),
    );
    const inhabitantIdx = header.findIndex((h) =>
      ['habitantes', 'qt_habitante', 'nu_moradores', 'inhabitant_count', 'pessoas'].includes(h),
    );

    if (streetIdx < 0) {
      throw new BadRequestException('Coluna de logradouro não encontrada (rua, logradouro, no_logradouro…).');
    }

    const rows: EsusRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[;,]/).map((c) => c.trim());
      const streetRef = cols[streetIdx] ?? '';
      if (!streetRef) continue;
      const familyCount = familyIdx >= 0 ? Math.max(0, parseInt(cols[familyIdx] ?? '0', 10) || 0) : 0;
      const inhabitantCount =
        inhabitantIdx >= 0 ? Math.max(0, parseInt(cols[inhabitantIdx] ?? '0', 10) || 0) : 0;
      rows.push({ streetRef, familyCount, inhabitantCount });
    }

    if (rows.length === 0) {
      throw new BadRequestException('Nenhuma linha válida na planilha.');
    }
    return rows;
  }

  async importCsv(municipalityId: string, content: string, userId: string) {
    await this.prisma.municipality.findUniqueOrThrow({ where: { id: municipalityId } });
    const items = this.parseCsv(content);
    const result = await this.applyImport(municipalityId, items, userId, 'esus-csv');

    const syncedAt = new Date();
    await this.prisma.municipality.update({
      where: { id: municipalityId },
      data: { esusImportCsv: content, esusLastSyncAt: syncedAt },
    });

    invalidateDashboardIndicators(municipalityId);

    return {
      ok: true,
      message: `${result.updated} de ${result.total} ruas atualizadas${
        result.errors.length > 0 ? ` (${result.errors.length} com aviso)` : ''
      }`,
      lastSyncAt: syncedAt.toISOString(),
      ...result,
    };
  }

  async syncLast(municipalityId: string, userId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { esusImportCsv: true, esusLastSyncAt: true },
    });
    if (!municipality?.esusImportCsv?.trim()) {
      throw new BadRequestException(
        'Nenhuma importação e-SUS anterior neste município. Importe um CSV primeiro.',
      );
    }

    const items = this.parseCsv(municipality.esusImportCsv);
    const result = await this.applyImport(municipalityId, items, userId, 'esus-sync');
    const syncedAt = new Date();

    await this.prisma.municipality.update({
      where: { id: municipalityId },
      data: { esusLastSyncAt: syncedAt },
    });

    invalidateDashboardIndicators(municipalityId);

    return {
      ok: true,
      message: `${result.updated} de ${result.total} ruas atualizadas${
        result.errors.length > 0 ? ` (${result.errors.length} com aviso)` : ''
      }`,
      lastSyncAt: syncedAt.toISOString(),
      ...result,
    };
  }

  private async applyImport(
    municipalityId: string,
    items: EsusRow[],
    userId: string,
    source: 'esus-csv' | 'esus-sync',
  ) {
    const streets = await this.prisma.street.findMany({
      where: { municipalityId },
      select: { id: true, name: true, streetType: true },
    });
    const catalog = buildStreetRefCatalog(streets);

    const errors: Array<{ row: number; streetRef: string; message: string }> = [];
    const updates: Array<{ id: string; familyCount: number; inhabitantCount: number }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = i + 2;
      const match = matchStreetRef(item.streetRef, catalog);
      if (match.status === 'unmatched') {
        errors.push({ row, streetRef: item.streetRef, message: 'Rua não encontrada no SIGAPS' });
        continue;
      }
      if (match.status === 'ambiguous') {
        errors.push({
          row,
          streetRef: item.streetRef,
          message: 'Mais de uma rua corresponde a este logradouro',
        });
        continue;
      }
      updates.push({
        id: match.street.id,
        familyCount: item.familyCount,
        inhabitantCount: item.inhabitantCount,
      });
    }

    if (updates.length > 0) {
      await this.prisma.$transaction(
        updates.map((u) =>
          this.prisma.street.update({
            where: { id: u.id },
            data: {
              familyCount: u.familyCount,
              inhabitantCount: u.inhabitantCount,
            },
          }),
        ),
      );
    }

    await this.audit.log({
      userId,
      entityType: 'street',
      entityId: municipalityId,
      action: 'UPDATE_DEMOGRAPHICS',
      afterData: { source, updated: updates.length, total: items.length, errors: errors.length },
    });

    return { updated: updates.length, errors, total: items.length };
  }
}
