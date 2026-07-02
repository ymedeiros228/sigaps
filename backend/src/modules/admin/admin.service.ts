import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  getAuditLog(
    municipalityId: string,
    page = 1,
    limit = 50,
    filters?: {
      entityType?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.audit.findPaginated(municipalityId, page, limit, filters);
  }

  async exportAuditCsv(
    municipalityId: string,
    filters?: {
      entityType?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
    },
  ) {
    await this.prisma.municipality.findUniqueOrThrow({ where: { id: municipalityId } });
    const items = await this.audit.findForExport(municipalityId, filters);

    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = [
      'data_hora',
      'usuario',
      'email',
      'perfil',
      'entidade',
      'acao',
      'entity_id',
    ].join(';');

    const lines = items.map((log) =>
      [
        new Date(log.createdAt).toISOString(),
        log.user.name,
        log.user.email,
        log.user.role,
        log.entityType,
        log.action,
        log.entityId,
      ]
        .map((v) => escape(String(v ?? '')))
        .join(';'),
    );

    return `\uFEFF${header}\n${lines.join('\n')}`;
  }

  private async findUserInMunicipality(municipalityId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, municipalityId },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async createUser(municipalityId: string, dto: CreateUserDto, actorId: string) {
    await this.prisma.municipality.findUniqueOrThrow({ where: { id: municipalityId } });

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
        passwordHash,
        municipalityId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log({
      userId: actorId,
      entityType: 'user',
      entityId: user.id,
      action: 'CREATE',
      afterData: auditSnapshot(user as Record<string, unknown>),
    });

    return user;
  }

  async updateUser(
    municipalityId: string,
    userId: string,
    dto: UpdateUserDto,
    actorId: string,
  ) {
    const before = await this.findUserInMunicipality(municipalityId, userId);

    if (dto.email && dto.email !== before.email) {
      const dup = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (dup) throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    if (userId === actorId && dto.isActive === false) {
      throw new BadRequestException('Você não pode desativar sua própria conta.');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.audit.log({
      userId: actorId,
      entityType: 'user',
      entityId: user.id,
      action: 'UPDATE',
      beforeData: auditSnapshot(before as unknown as Record<string, unknown>, [
        'email',
        'name',
        'role',
        'isActive',
      ]),
      afterData: auditSnapshot(user as Record<string, unknown>),
    });

    return user;
  }

  async resetPassword(
    municipalityId: string,
    userId: string,
    password: string,
    actorId: string,
  ) {
    await this.findUserInMunicipality(municipalityId, userId);
    const passwordHash = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, refreshToken: null },
    });

    await this.audit.log({
      userId: actorId,
      entityType: 'user',
      entityId: userId,
      action: 'RESET_PASSWORD',
    });

    return { ok: true };
  }
}
