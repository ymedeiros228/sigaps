import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { compactLineStringGeojson } from '../../common/utils/compact-geojson';
import { AssignStreetsDto } from './dto/assign-streets.dto';

@Injectable()
export class StreetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByMunicipality(
    municipalityId: string,
    options: {
      microareaId?: string;
      search?: string;
      page?: number;
      limit?: number;
      mapOnly?: boolean;
    } = {},
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 500, 2000);
    const skip = (page - 1) * limit;
    const mapOnly = options.mapOnly ?? false;

    const where = {
      municipalityId,
      ...(mapOnly ? { osmId: { not: null } } : {}),
      ...(options.microareaId ? { microareaId: options.microareaId } : {}),
      ...(options.search
        ? { name: { contains: options.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      mapOnly
        ? this.prisma.street.findMany({
            where,
            skip,
            take: limit,
            select: {
              id: true,
              name: true,
              streetType: true,
              microareaId: true,
              osmId: true,
              geojson: true,
              microarea: { select: { id: true, name: true, number: true, color: true } },
            },
            orderBy: { name: 'asc' },
          })
        : this.prisma.street.findMany({
            where,
            skip,
            take: limit,
            include: {
              microarea: { select: { id: true, name: true, number: true, color: true } },
              neighborhood: { select: { id: true, name: true } },
            },
            orderBy: { name: 'asc' },
          }),
      this.prisma.street.count({ where }),
    ]);

    return {
      items: items.map((s) => ({
        ...s,
        geojson: compactLineStringGeojson(s.geojson),
        ...(mapOnly
          ? {
              osmId: (s as { osmId?: bigint | null }).osmId?.toString() ?? null,
              propertyCount: 0,
              familyCount: 0,
              inhabitantCount: 0,
              updatedAt: new Date(0).toISOString(),
            }
          : { osmId: (s as { osmId?: bigint | null }).osmId?.toString() ?? null }),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const street = await this.prisma.street.findUnique({
      where: { id },
      include: {
        microarea: {
          include: { acs: { select: { id: true, name: true, phone: true } } },
        },
        neighborhood: true,
      },
    });
    if (!street) throw new NotFoundException('Rua não encontrada');
    return { ...street, osmId: street.osmId?.toString() ?? null };
  }

  async assignToMicroarea(
    dto: AssignStreetsDto,
    userId: string,
    forceTransfer = false,
  ) {
    const microarea = await this.prisma.microarea.findUnique({
      where: { id: dto.microareaId },
    });
    if (!microarea) throw new NotFoundException('Microárea não encontrada');

    const streets = await this.prisma.street.findMany({
      where: { id: { in: dto.streetIds } },
      include: { microarea: true },
    });

    if (streets.length !== dto.streetIds.length) {
      throw new NotFoundException('Uma ou mais ruas não foram encontradas');
    }

    const conflicts = streets.filter(
      (s) => s.microareaId && s.microareaId !== dto.microareaId,
    );

    if (conflicts.length && !forceTransfer) {
      const first = conflicts[0];
      throw new ConflictException({
        message: `A ${first.streetType ?? 'Rua'} ${first.name} já pertence à ${first.microarea?.name}. Deseja transferi-la para a ${microarea.name}?`,
        code: 'STREET_ALREADY_ASSIGNED',
        conflicts: conflicts.map((c) => ({
          streetId: c.id,
          streetName: c.name,
          currentMicroarea: c.microarea?.name,
        })),
      });
    }

    const beforeById = new Map(streets.map((s) => [s.id, s.microareaId]));

    await this.prisma.street.updateMany({
      where: { id: { in: dto.streetIds } },
      data: { microareaId: dto.microareaId },
    });

    await this.prisma.auditLog.createMany({
      data: streets.map((street) => ({
        userId,
        entityType: 'street',
        entityId: street.id,
        action: 'ASSIGN_MICROAREA',
        beforeData: { microareaId: beforeById.get(street.id) ?? null },
        afterData: { microareaId: dto.microareaId },
      })),
    });

    this.scheduleEnvelopeUpdate(dto.microareaId);

    return {
      updated: dto.streetIds.length,
      microareaId: dto.microareaId,
    };
  }

  async clearAllAssignments(municipalityId: string, userId: string) {
    const painted = await this.prisma.street.findMany({
      where: { municipalityId, microareaId: { not: null } },
      select: { id: true, microareaId: true },
    });

    if (painted.length === 0) {
      return { cleared: 0 };
    }

    await this.prisma.street.updateMany({
      where: { municipalityId, microareaId: { not: null } },
      data: { microareaId: null },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        entityType: 'municipality',
        entityId: municipalityId,
        action: 'CLEAR_STREET_ASSIGNMENTS',
        afterData: { cleared: painted.length },
      },
    });

    return { cleared: painted.length };
  }

  async suggestMicroarea(streetId: string) {
    try {
      const suggestions = await this.prisma.$queryRaw<
        Array<{ id: string; name: string; color: string; distance: number }>
      >`
        SELECT m.id, m.name, m.color,
          MIN(ST_Distance(s.geom::geography, ms.geom::geography)) as distance
        FROM microareas m
        JOIN streets ms ON ms.microarea_id = m.id
        CROSS JOIN streets s
        WHERE s.id = ${streetId}::uuid
          AND ms.geom IS NOT NULL
          AND s.geom IS NOT NULL
          AND m.municipality_id = s.municipality_id
        GROUP BY m.id, m.name, m.color
        ORDER BY distance ASC
        LIMIT 3
      `;
      return suggestions;
    } catch {
      return [];
    }
  }

  private scheduleEnvelopeUpdate(microareaId: string) {
    setImmediate(() => {
      void this.updateMicroareaEnvelope(microareaId);
    });
  }

  private async updateMicroareaEnvelope(microareaId: string) {
    try {
      await this.prisma.$executeRaw`
        SELECT update_microarea_envelope(${microareaId}::uuid)
      `;
    } catch {
      /* PostGIS opcional — ignorar se extensão não instalada */
    }
  }
}
