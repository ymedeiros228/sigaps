import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { AssignStreetsDto } from './dto/assign-streets.dto';

@Injectable()
export class StreetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findByMunicipality(
    municipalityId: string,
    options: { microareaId?: string; search?: string; page?: number; limit?: number } = {},
  ) {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 500, 2000);
    const skip = (page - 1) * limit;

    const where = {
      municipalityId,
      ...(options.microareaId ? { microareaId: options.microareaId } : {}),
      ...(options.search
        ? { name: { contains: options.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.street.findMany({
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
        osmId: s.osmId?.toString() ?? null,
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

    const results = [];
    for (const street of streets) {
      const before = { microareaId: street.microareaId };
      const updated = await this.prisma.street.update({
        where: { id: street.id },
        data: { microareaId: dto.microareaId },
        include: { microarea: true },
      });

      await this.audit.log({
        userId,
        entityType: 'street',
        entityId: street.id,
        action: 'ASSIGN_MICROAREA',
        beforeData: before,
        afterData: { microareaId: dto.microareaId },
      });

      results.push(updated);
    }

    await this.updateMicroareaEnvelope(dto.microareaId);
    for (const c of conflicts) {
      if (c.microareaId) await this.updateMicroareaEnvelope(c.microareaId);
    }

    return results.map((s) => ({ ...s, osmId: s.osmId?.toString() ?? null }));
  }

  async suggestMicroarea(streetId: string) {
    const street = await this.prisma.street.findUniqueOrThrow({
      where: { id: streetId },
    });

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
  }

  private async updateMicroareaEnvelope(microareaId: string) {
    await this.prisma.$executeRaw`
      SELECT update_microarea_envelope(${microareaId}::uuid)
    `;
  }
}
