import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getOverview(municipalityId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado');

    const [
      users,
      ubs,
      acs,
      microareas,
      streets,
      assignedStreets,
      paintZones,
      auditTotal,
      activeUsers,
    ] = await Promise.all([
      this.prisma.user.findMany({
        where: { municipalityId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ubs.count({ where: { municipalityId } }),
      this.prisma.acs.count({ where: { municipalityId } }),
      this.prisma.microarea.count({ where: { municipalityId } }),
      this.prisma.street.count({ where: { municipalityId } }),
      this.prisma.street.count({ where: { municipalityId, microareaId: { not: null } } }),
      this.prisma.microareaPaintZone.count({ where: { municipalityId } }),
      this.prisma.auditLog.count({ where: { user: { municipalityId } } }),
      this.prisma.user.count({ where: { municipalityId, isActive: true } }),
    ]);

    const acsSemMicro = await this.prisma.acs.count({
      where: { municipalityId, microarea: null, status: 'ATIVO' },
    });

    const commit =
      process.env.RENDER_GIT_COMMIT?.trim() ||
      process.env.GIT_COMMIT?.trim() ||
      null;

    return {
      municipality: {
        id: municipality.id,
        name: municipality.name,
        state: municipality.state,
        prefecture: municipality.prefecture,
        secretariat: municipality.secretariat,
        logoUrl: municipality.logoUrl,
        updatedAt: municipality.updatedAt,
      },
      counts: {
        users: users.length,
        activeUsers,
        ubs,
        acs,
        acsSemMicro,
        microareas,
        streets,
        assignedStreets,
        paintZones,
        auditLogs: auditTotal,
        coverage: streets > 0 ? Math.round((assignedStreets / streets) * 100) : 0,
      },
      users,
      system: {
        commit,
        nodeEnv: process.env.NODE_ENV ?? 'development',
        exportedAt: new Date().toISOString(),
      },
    };
  }

  getAuditLog(municipalityId: string, page = 1, limit = 50) {
    return this.audit.findPaginated(municipalityId, page, limit);
  }
}
