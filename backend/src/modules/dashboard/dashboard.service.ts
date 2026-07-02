import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

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
      assignedStreets,
      streetsWithNeighborhood,
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
        () =>
          this.prisma.street.aggregate({
            where: { municipalityId },
            _sum: { familyCount: true, inhabitantCount: true },
            _count: { _all: true },
          }),
        { _sum: { familyCount: 0, inhabitantCount: 0 }, _count: { _all: 0 } },
      ),
      safe(
        'assignedStreets',
        () =>
          this.prisma.street.count({
            where: { municipalityId, microareaId: { not: null } },
          }),
        0,
      ),
      safe(
        'streetsWithNeighborhood',
        () =>
          this.prisma.street.count({
            where: { municipalityId, neighborhoodId: { not: null } },
          }),
        0,
      ),
      safe('recentChanges', () => this.audit.findRecent(municipalityId, 10), []),
    ]);

    const streetsCount = streetStats._count._all;
    const microareasCount = microareasList.length;

    return {
      ubs: ubsCount,
      acs: acsCount,
      microareas: microareasCount,
      streets: streetsCount,
      families: streetStats._sum.familyCount ?? 0,
      inhabitants: streetStats._sum.inhabitantCount ?? 0,
      coverage:
        streetsCount > 0 ? Math.round((assignedStreets / streetsCount) * 100) : 0,
      assignedStreets,
      streetsWithNeighborhood,
      streetsWithoutNeighborhood: Math.max(0, streetsCount - streetsWithNeighborhood),
      microareasChart: microareasList.map((m) => ({
        name: m.name,
        color: m.color,
        streets: m._count.streets,
      })),
      recentChanges,
    };
  }
}
