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
      streetsCount,
      familiesSum,
      inhabitantsSum,
      recentChanges,
    ] = await Promise.all([
      this.prisma.ubs.count({ where: { municipalityId } }),
      this.prisma.acs.count({
        where: { municipalityId, status: 'ATIVO' },
      }),
      this.prisma.microarea.count({ where: { municipalityId } }),
      this.prisma.street.count({ where: { municipalityId } }),
      this.prisma.street.aggregate({
        where: { municipalityId },
        _sum: { familyCount: true },
      }),
      this.prisma.street.aggregate({
        where: { municipalityId },
        _sum: { inhabitantCount: true },
      }),
      this.audit.findRecent(municipalityId, 10),
    ]);

    const assignedStreets = await this.prisma.street.count({
      where: { municipalityId, microareaId: { not: null } },
    });

    const coverage =
      streetsCount > 0
        ? Math.round((assignedStreets / streetsCount) * 100)
        : 0;

    const microareasByStreet = await this.prisma.microarea.findMany({
      where: { municipalityId },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { streets: true } },
      },
    });

    return {
      ubs: ubsCount,
      acs: acsCount,
      microareas: microareasCount,
      streets: streetsCount,
      families: familiesSum._sum.familyCount ?? 0,
      inhabitants: inhabitantsSum._sum.inhabitantCount ?? 0,
      coverage,
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
