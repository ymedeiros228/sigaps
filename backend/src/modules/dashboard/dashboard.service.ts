import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

export interface AcsCoverageRow {
  acsId: string;
  acsName: string;
  microareaId: string | null;
  microareaName: string | null;
  microareaNumber: number | null;
  ubsName: string | null;
  streetCount: number;
  microareaStreetTotal: number;
  streetCoveragePct: number;
  municipalitySharePct: number;
  familyCount: number;
  inhabitantCount: number;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getIndicators(municipalityId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true },
    });
    if (!municipality) {
      throw new NotFoundException('Município não encontrado');
    }

    const safe = async <T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        this.logger.error(`Dashboard ${label} falhou: ${(error as Error).message}`);
        return fallback;
      }
    };

    const [
      ubsCount,
      acsCount,
      microareasList,
      streetStats,
      recentChanges,
    ] = await Promise.all([
      safe('ubs', () => this.prisma.ubs.count({ where: { municipalityId } }), 0),
      safe(
        'acs',
        () => this.prisma.acs.count({ where: { municipalityId, status: 'ATIVO' } }),
        0,
      ),
      safe(
        'microareas',
        () =>
          this.prisma.microarea.findMany({
            where: { municipalityId },
            select: {
              id: true,
              name: true,
              color: true,
              _count: { select: { streets: true } },
            },
            orderBy: { number: 'asc' },
          }),
        [],
      ),
      safe(
        'streetStats',
        async () => {
          const rows = await this.prisma.$queryRaw<
            Array<{
              total: bigint;
              assigned: bigint;
              with_neighborhood: bigint;
              families: bigint | null;
              inhabitants: bigint | null;
            }>
          >`
            SELECT
              COUNT(*)::bigint AS total,
              COUNT(microarea_id)::bigint AS assigned,
              COUNT(neighborhood_id)::bigint AS with_neighborhood,
              COALESCE(SUM(family_count), 0)::bigint AS families,
              COALESCE(SUM(inhabitant_count), 0)::bigint AS inhabitants
            FROM streets
            WHERE municipality_id = ${municipalityId}::uuid
          `;
          const row = rows[0];
          return {
            total: Number(row?.total ?? 0),
            assigned: Number(row?.assigned ?? 0),
            withNeighborhood: Number(row?.with_neighborhood ?? 0),
            families: Number(row?.families ?? 0),
            inhabitants: Number(row?.inhabitants ?? 0),
          };
        },
        { total: 0, assigned: 0, withNeighborhood: 0, families: 0, inhabitants: 0 },
      ),
      safe('recentChanges', () => this.audit.findRecent(municipalityId, 10), []),
    ]);

    const streetsCount = streetStats.total;
    const microareasCount = microareasList.length;

    return {
      ubs: ubsCount,
      acs: acsCount,
      microareas: microareasCount,
      streets: streetsCount,
      families: streetStats.families,
      inhabitants: streetStats.inhabitants,
      coverage:
        streetsCount > 0 ? Math.round((streetStats.assigned / streetsCount) * 100) : 0,
      assignedStreets: streetStats.assigned,
      streetsWithNeighborhood: streetStats.withNeighborhood,
      streetsWithoutNeighborhood: Math.max(0, streetsCount - streetStats.withNeighborhood),
      microareasChart: microareasList.map((m) => ({
        name: m.name,
        color: m.color,
        streets: m._count.streets,
      })),
      recentChanges,
    };
  }

  async getAcsCoverage(municipalityId: string): Promise<AcsCoverageRow[]> {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true },
    });
    if (!municipality) {
      throw new NotFoundException('Município não encontrado');
    }

    const [municipalityStreetTotal, acsList, streetAggByMicroarea, neighborhoodStreetCounts] =
      await Promise.all([
        this.prisma.street.count({ where: { municipalityId } }),
        this.prisma.acs.findMany({
          where: { municipalityId, status: 'ATIVO' },
          select: {
            id: true,
            name: true,
            microarea: {
              select: {
                id: true,
                name: true,
                number: true,
                neighborhoodId: true,
                ubs: { select: { name: true } },
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.street.groupBy({
          by: ['microareaId'],
          where: { municipalityId, microareaId: { not: null } },
          _count: { _all: true },
          _sum: { familyCount: true, inhabitantCount: true },
        }),
        this.prisma.street.groupBy({
          by: ['neighborhoodId'],
          where: { municipalityId, neighborhoodId: { not: null } },
          _count: { _all: true },
        }),
      ]);

    const paintedByMicroarea = new Map(
      streetAggByMicroarea.map((row) => [
        row.microareaId!,
        {
          count: row._count._all,
          families: row._sum.familyCount ?? 0,
          inhabitants: row._sum.inhabitantCount ?? 0,
        },
      ]),
    );
    const streetsByNeighborhood = new Map(
      neighborhoodStreetCounts.map((row) => [row.neighborhoodId!, row._count._all]),
    );

    return acsList.map((acs) => {
      const microarea = acs.microarea;
      const painted = microarea ? paintedByMicroarea.get(microarea.id) : undefined;
      const streetCount = painted?.count ?? 0;
      const familyCount = painted?.families ?? 0;
      const inhabitantCount = painted?.inhabitants ?? 0;

      const microareaStreetTotal = microarea?.neighborhoodId
        ? (streetsByNeighborhood.get(microarea.neighborhoodId) ?? streetCount)
        : streetCount;

      const streetCoveragePct =
        microareaStreetTotal > 0
          ? Math.min(100, Math.round((streetCount / microareaStreetTotal) * 100))
          : 0;
      const municipalitySharePct =
        municipalityStreetTotal > 0
          ? Math.round((streetCount / municipalityStreetTotal) * 100)
          : 0;

      return {
        acsId: acs.id,
        acsName: acs.name,
        microareaId: microarea?.id ?? null,
        microareaName: microarea?.name ?? null,
        microareaNumber: microarea?.number ?? null,
        ubsName: microarea?.ubs?.name ?? null,
        streetCount,
        microareaStreetTotal,
        streetCoveragePct,
        municipalitySharePct,
        familyCount,
        inhabitantCount,
      };
    });
  }

  buildAcsCoverageCsv(rows: AcsCoverageRow[]): string {
    const header = [
      'acs',
      'microarea',
      'numero_microarea',
      'ubs',
      'ruas_pintadas',
      'ruas_microarea',
      'cobertura_microarea_pct',
      'participacao_municipio_pct',
      'familias',
      'habitantes',
    ].join(';');

    const lines = rows.map((row) =>
      [
        row.acsName,
        row.microareaName ?? '',
        row.microareaNumber ?? '',
        row.ubsName ?? '',
        row.streetCount,
        row.microareaStreetTotal,
        row.streetCoveragePct,
        row.municipalitySharePct,
        row.familyCount,
        row.inhabitantCount,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(';'),
    );

    return [header, ...lines].join('\n');
  }
}
