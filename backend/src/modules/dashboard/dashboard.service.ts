import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getIndicators(municipalityId: string) {
    const [
      ubsCount,
      acsCount,
      microareasCount,
      streetStats,
      assignedStreets,
      microareasByStreet,
      recentChanges,
    ] = await Promise.all([
      this.prisma.ubs.count({ where: { municipalityId } }),
      this.prisma.acs.count({ where: { municipalityId, status: 'ATIVO' } }),
      this.prisma.microarea.count({ where: { municipalityId } }),
      this.prisma.street.aggregate({
        where: { municipalityId },
        _sum: { familyCount: true, inhabitantCount: true },
        _count: { _all: true },
      }),
      this.prisma.street.count({
        where: { municipalityId, microareaId: { not: null } },
      }),
      this.prisma.microarea.findMany({
        where: { municipalityId },
        select: {
          id: true,
          name: true,
          color: true,
          _count: { select: { streets: true } },
        },
      }),
      this.audit.findRecent(municipalityId, 10).catch(() => []),
    ]);

    const streetsCount = streetStats._count._all;

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
      microareasChart: microareasByStreet.map((m) => ({
        name: m.name,
        color: m.color,
        streets: m._count.streets,
      })),
      recentChanges,
    };
  }
}
