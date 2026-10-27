import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { clearMunicipalityPaint } from '../../common/utils/clear-municipality-paint.util';
import { copyMunicipalityMap } from '../../common/utils/copy-municipality-map.util';
import { invalidateDashboardIndicators } from '../../common/utils/dashboard-cache.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { invalidateAuthUser } from '../auth/jwt.strategy';
import { accessRole } from '../../common/utils/role-rank.util';

/** Campos da conta que saem da API (sem senha nem token). */
const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  isAdmin: true,
  municipalityId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

/** Copiar o mapa (milhares de ruas) passa do limite padrão de 5 s da transação. */
const OWN_MAP_TX = { maxWait: 10_000, timeout: 60_000 };

/**
 * Contas da equipe de um mapa: todas as da mesma família de mapas (o original e todas as
 * cópias feitas dele, em qualquer nível). Cada conta tem o seu mapa, mas quem ganhou mapa
 * próprio não some da Equipe dos outros.
 */
function teamUserWhere(familyIds: string[]): Prisma.UserWhereInput {
  return { municipalityId: { in: familyIds } };
}

/** Sobe até o mapa original (sem `parent_id`) e junta ele com todas as cópias abaixo. */
export async function mapFamilyIds(
  prisma: Pick<PrismaService, 'municipality'>,
  municipalityId: string,
): Promise<string[]> {
  let rootId = municipalityId;
  for (let i = 0; i < 50; i++) {
    const m = await prisma.municipality.findUnique({
      where: { id: rootId },
      select: { parentId: true },
    });
    if (!m?.parentId) break;
    rootId = m.parentId;
  }
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const children = await prisma.municipality.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !ids.includes(id));
    ids.push(...frontier);
  }
  return ids;
}

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
    const family = await mapFamilyIds(this.prisma, municipalityId);

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
        where: teamUserWhere(family),
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          municipalityId: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ubs.count({ where: { municipalityId } }),
      this.prisma.acs.count({ where: { municipalityId } }),
      this.prisma.microarea.count({ where: { municipalityId } }),
      this.prisma.street.count({ where: { municipalityId } }),
      this.prisma.street.count({
        where: { municipalityId, microareaId: { not: null } },
      }),
      this.prisma.microareaPaintZone.count({ where: { municipalityId } }),
      this.prisma.auditLog.count({ where: { user: { municipalityId } } }),
      this.prisma.user.count({
        where: { ...teamUserWhere(family), isActive: true },
      }),
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
        coverage:
          streets > 0 ? Math.round((assignedStreets / streets) * 100) : 0,
      },
      delivery: {
        dataReady:
          streets > 0 && microareas > 0 && ubs > 0 && acsSemMicro === 0,
        mapClean: assignedStreets === 0 && paintZones === 0,
        readyForHandoff:
          streets > 0 &&
          microareas > 0 &&
          ubs > 0 &&
          acsSemMicro === 0 &&
          assignedStreets === 0 &&
          paintZones === 0,
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
    await this.prisma.municipality.findUniqueOrThrow({
      where: { id: municipalityId },
    });
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

  /** Contas da equipe do mapa, sem senha nem token (tela Equipe). */
  async listUsers(municipalityId: string) {
    const family = await mapFamilyIds(this.prisma, municipalityId);
    return this.prisma.user.findMany({
      where: teamUserWhere(family),
      select: USER_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Conta do município (para conferir o perfil antes de alterar). Quem tem a função de
   * administrador conta como ADMINISTRADOR: senão um coordenador redefiniria a senha
   * dele e entraria com acesso total.
   */
  async getUser(municipalityId: string, userId: string) {
    const user = await this.findUserInMunicipality(municipalityId, userId);
    return { id: user.id, role: accessRole(user) };
  }

  private async findUserInMunicipality(municipalityId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...teamUserWhere(await mapFamilyIds(this.prisma, municipalityId)),
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async createUser(
    municipalityId: string,
    dto: CreateUserDto,
    actorId: string,
  ) {
    await this.prisma.municipality.findUniqueOrThrow({
      where: { id: municipalityId },
    });

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    // Toda conta nova ganha o próprio mapa (cópia do mapa de quem criou, sem pintura):
    // cada conta pinta e gera o PDF do seu, sem mexer no dos outros.
    const { user, ownMap } = await this.prisma.$transaction(async (tx) => {
      const ownMap = await copyMunicipalityMap(tx, municipalityId);
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          role: dto.role,
          isAdmin: dto.isAdmin === true && dto.role !== UserRole.ACS,
          passwordHash,
          municipalityId: ownMap.id,
        },
        select: USER_SELECT,
      });
      return { user, ownMap };
    }, OWN_MAP_TX);

    await this.audit.log({
      userId: actorId,
      entityType: 'user',
      entityId: user.id,
      action: 'CREATE',
      afterData: auditSnapshot({
        ...(user as Record<string, unknown>),
        ownMapFrom: municipalityId,
        ownMapStreets: ownMap.streets,
      }),
    });

    return user;
  }

  /**
   * Conta que ainda divide o mapa com quem a criou ganha o próprio (cópia sem pintura).
   * O mapa de origem e a pintura dele ficam como estão; quem deu o mapa continua no dele.
   */
  async giveOwnMap(municipalityId: string, userId: string, actorId: string) {
    const before = await this.findUserInMunicipality(municipalityId, userId);
    if (before.municipalityId !== municipalityId) {
      throw new BadRequestException('Esta conta já tem mapa próprio.');
    }
    if (userId === actorId) {
      throw new BadRequestException(
        'Você continua no mapa atual; dê mapa próprio às outras contas.',
      );
    }

    const linkedAcs = await this.prisma.acs.findUnique({
      where: { userId },
      select: { id: true },
    });
    const { user, ownMap } = await this.prisma.$transaction(async (tx) => {
      const ownMap = await copyMunicipalityMap(tx, municipalityId);
      // O cadastro de ACS ligado à conta é do mapa de origem e fica lá, sem a conta.
      if (linkedAcs) {
        await tx.acs.update({
          where: { id: linkedAcs.id },
          data: { userId: null },
        });
      }
      const user = await tx.user.update({
        where: { id: userId },
        data: { municipalityId: ownMap.id },
        select: USER_SELECT,
      });
      return { user, ownMap };
    }, OWN_MAP_TX);
    invalidateAuthUser(userId);

    await this.audit.log({
      userId: actorId,
      entityType: 'user',
      entityId: userId,
      action: 'OWN_MAP',
      beforeData: { municipalityId, acsId: linkedAcs?.id ?? null },
      afterData: { municipalityId: ownMap.id, streets: ownMap.streets },
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
      const dup = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (dup)
        throw new ConflictException('Já existe um usuário com este e-mail.');
    }

    if (userId === actorId && dto.isActive === false) {
      throw new BadRequestException(
        'Você não pode desativar sua própria conta.',
      );
    }

    // A função de administrador não vale para ACS; virar ACS desliga a função.
    const role = dto.role ?? before.role;
    if (dto.isAdmin === true && role === UserRole.ACS) {
      throw new BadRequestException(
        'O ACS não pode ter a função de administrador.',
      );
    }
    const isAdmin =
      role === UserRole.ACS ? false : (dto.isAdmin ?? before.isAdmin);
    if (userId === actorId && before.isAdmin && !isAdmin) {
      throw new BadRequestException(
        'Você não pode tirar a sua própria função de administrador.',
      );
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { ...dto, isAdmin },
      select: USER_SELECT,
    });
    invalidateAuthUser(userId);

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
        'isAdmin',
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
    invalidateAuthUser(userId);

    await this.audit.log({
      userId: actorId,
      entityType: 'user',
      entityId: userId,
      action: 'RESET_PASSWORD',
    });

    return { ok: true };
  }

  async prepareForDelivery(municipalityId: string, actorId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: {
        id: true,
        name: true,
        mapHomologatedAt: true,
        mapHomologatedBy: true,
      },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado');

    const cleared = await clearMunicipalityPaint(this.prisma, municipalityId);

    let homologationRevoked = false;
    if (municipality.mapHomologatedAt) {
      await this.prisma.municipality.update({
        where: { id: municipalityId },
        data: {
          mapHomologatedAt: null,
          mapHomologatedBy: null,
          mapHomologationNotes: null,
        },
      });
      homologationRevoked = true;
    }

    await this.audit.log({
      userId: actorId,
      entityType: 'municipality',
      entityId: municipalityId,
      action: 'PREPARE_DELIVERY',
      beforeData: {
        mapHomologatedAt: municipality.mapHomologatedAt,
        mapHomologatedBy: municipality.mapHomologatedBy,
      },
      afterData: {
        clearedStreets: cleared.clearedStreets,
        clearedPaintZones: cleared.clearedPaintZones,
        homologationRevoked,
      },
    });

    invalidateDashboardIndicators(municipalityId);

    return {
      ok: true,
      clearedStreets: cleared.clearedStreets,
      clearedPaintZones: cleared.clearedPaintZones,
      homologationRevoked,
      message:
        'Mapa zerado para entrega. Cadastros (UBS, ACS, microáreas, ruas) foram mantidos.',
    };
  }
}
