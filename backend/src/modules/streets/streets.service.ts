import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { compactLineStringGeojson } from '../../common/utils/compact-geojson';
import { applyAcsMicroareaScope, type AuthViewer } from '../../common/utils/acs-scope.util';
import { invalidateDashboardIndicators } from '../../common/utils/dashboard-cache.util';
import { withDbRetry } from '../../common/utils/prisma-retry.util';
import { AssignStreetsDto } from './dto/assign-streets.dto';
import { UnassignStreetsDto } from './dto/unassign-streets.dto';
import { UpdateStreetDemographicsDto } from './dto/update-street-demographics.dto';

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
      neighborhoodId?: string;
      search?: string;
      page?: number;
      limit?: number;
      mapOnly?: boolean;
      geoPrecision?: number;
      bbox?: string;
      minLat?: number;
      maxLat?: number;
      minLng?: number;
      maxLng?: number;
    } = {},
    viewer?: AuthViewer,
  ) {
    const scopedMicroareaId = await applyAcsMicroareaScope(
      this.prisma,
      viewer,
      options.microareaId,
    );
    if (scopedMicroareaId === '__none__') {
      return { items: [], total: 0, page: 1, limit: options.limit ?? 500, totalPages: 0 };
    }

    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 500, options.mapOnly ? 5000 : 2000);
    const skip = (page - 1) * limit;
    const mapOnly = options.mapOnly ?? false;
    const geoPrecision = options.geoPrecision ?? (mapOnly ? 4 : 5);
    const bbox = this.parseBbox(
      options.bbox,
      options.minLat,
      options.maxLat,
      options.minLng,
      options.maxLng,
    );

    if (mapOnly && bbox) {
      return this.findMapStreetsInBbox(municipalityId, {
        bbox,
        page,
        limit,
        geoPrecision,
        microareaId: scopedMicroareaId,
        neighborhoodId: options.neighborhoodId,
        search: options.search,
      });
    }

    const where = {
      municipalityId,
      ...(mapOnly ? { osmId: { not: null } } : {}),
      ...(scopedMicroareaId ? { microareaId: scopedMicroareaId } : {}),
      ...(options.neighborhoodId ? { neighborhoodId: options.neighborhoodId } : {}),
      ...(options.search
        ? { name: { contains: options.search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await withDbRetry(() =>
      Promise.all([
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
                neighborhoodId: true,
                osmId: true,
                geojson: true,
                familyCount: true,
                inhabitantCount: true,
                propertyCount: true,
                microarea: { select: { id: true, name: true, number: true, color: true } },
                neighborhood: { select: { id: true, name: true } },
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
      ]),
    );

    return {
      items: items.map((s) => ({
        ...s,
        geojson: compactLineStringGeojson(s.geojson, geoPrecision),
        ...(mapOnly
          ? {
              osmId: (s as { osmId?: bigint | null }).osmId?.toString() ?? null,
              propertyCount: (s as { propertyCount?: number }).propertyCount ?? 0,
              familyCount: (s as { familyCount?: number }).familyCount ?? 0,
              inhabitantCount: (s as { inhabitantCount?: number }).inhabitantCount ?? 0,
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
    const affectedMicroareas = new Set<string>([dto.microareaId]);
    for (const previousMicroareaId of beforeById.values()) {
      if (previousMicroareaId && previousMicroareaId !== dto.microareaId) {
        affectedMicroareas.add(previousMicroareaId);
      }
    }

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

    await this.updateAffectedEnvelopes(affectedMicroareas);
    invalidateDashboardIndicators(microarea.municipalityId);

    return {
      updated: dto.streetIds.length,
      microareaId: dto.microareaId,
    };
  }

  async assignToNeighborhood(
    dto: { streetIds: string[]; neighborhoodId?: string | null },
    userId: string,
  ) {
    const streets = await this.prisma.street.findMany({
      where: { id: { in: dto.streetIds } },
      select: { id: true, neighborhoodId: true, municipalityId: true },
    });

    if (streets.length !== dto.streetIds.length) {
      throw new NotFoundException('Uma ou mais ruas não foram encontradas');
    }

    if (dto.neighborhoodId) {
      const municipalityId = streets[0].municipalityId;
      const neighborhood = await this.prisma.neighborhood.findFirst({
        where: { id: dto.neighborhoodId, municipalityId },
      });
      if (!neighborhood) {
        throw new NotFoundException('Bairro não encontrado neste município');
      }
    }

    await this.prisma.street.updateMany({
      where: { id: { in: dto.streetIds } },
      data: { neighborhoodId: dto.neighborhoodId ?? null },
    });

    await this.prisma.auditLog.createMany({
      data: streets.map((street) => ({
        userId,
        entityType: 'street',
        entityId: street.id,
        action: 'ASSIGN_NEIGHBORHOOD',
        beforeData: { neighborhoodId: street.neighborhoodId },
        afterData: { neighborhoodId: dto.neighborhoodId ?? null },
      })),
    });

    return { updated: dto.streetIds.length, neighborhoodId: dto.neighborhoodId ?? null };
  }

  async bulkAssignNeighborhood(
    municipalityId: string,
    items: Array<{ streetRef: string; neighborhoodRef: string }>,
    userId: string,
  ) {
    const uniqueStreetRefs = [
      ...new Set(items.map((i) => i.streetRef.trim().toLowerCase())),
    ];

    const [streets, neighborhoods] = await Promise.all([
      this.prisma.street.findMany({
        where: {
          municipalityId,
          OR: uniqueStreetRefs.flatMap((ref) => [
            { name: { equals: ref, mode: 'insensitive' as const } },
            { name: { contains: ref, mode: 'insensitive' as const } },
          ]),
        },
        select: { id: true, name: true, neighborhoodId: true },
      }),
      this.prisma.neighborhood.findMany({
        where: { municipalityId },
        select: { id: true, name: true },
      }),
    ]);

    const neighborhoodByName = new Map(
      neighborhoods.map((n) => [n.name.toLowerCase(), n]),
    );
    const streetsByExactName = new Map<string, typeof streets>();
    for (const street of streets) {
      const key = street.name.toLowerCase();
      const list = streetsByExactName.get(key) ?? [];
      list.push(street);
      streetsByExactName.set(key, list);
    }

    let updated = 0;
    const errors: Array<{ row: number; streetRef: string; message: string }> = [];
    const pendingUpdates = new Map<
      string,
      { neighborhoodId: string; streetIds: string[]; before: Map<string, string | null> }
    >();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = i + 1;
      const neighborhood = neighborhoodByName.get(item.neighborhoodRef.trim().toLowerCase());
      if (!neighborhood) {
        errors.push({
          row,
          streetRef: item.streetRef,
          message: `Bairro "${item.neighborhoodRef}" não encontrado`,
        });
        continue;
      }

      const ref = item.streetRef.trim().toLowerCase();
      let matched = streetsByExactName.get(ref) ?? [];
      if (matched.length === 0) {
        const partial = streets.filter((s) => s.name.toLowerCase().includes(ref));
        if (partial.length === 1) {
          matched = partial;
        } else if (partial.length > 1) {
          errors.push({
            row,
            streetRef: item.streetRef,
            message: 'Nome de rua ambíguo — refine o nome',
          });
          continue;
        }
      }

      if (matched.length === 0) {
        errors.push({ row, streetRef: item.streetRef, message: 'Rua não encontrada' });
        continue;
      }

      const group = pendingUpdates.get(neighborhood.id) ?? {
        neighborhoodId: neighborhood.id,
        streetIds: [],
        before: new Map<string, string | null>(),
      };
      for (const street of matched) {
        if (street.neighborhoodId === neighborhood.id) continue;
        if (!group.streetIds.includes(street.id)) {
          group.streetIds.push(street.id);
          group.before.set(street.id, street.neighborhoodId);
        }
      }
      if (group.streetIds.length > 0) {
        pendingUpdates.set(neighborhood.id, group);
      }
    }

    const auditRows: Array<{
      userId: string;
      entityType: string;
      entityId: string;
      action: string;
      beforeData: object;
      afterData: object;
    }> = [];

    for (const group of pendingUpdates.values()) {
      await this.prisma.street.updateMany({
        where: { id: { in: group.streetIds } },
        data: { neighborhoodId: group.neighborhoodId },
      });
      for (const streetId of group.streetIds) {
        auditRows.push({
          userId,
          entityType: 'street',
          entityId: streetId,
          action: 'ASSIGN_NEIGHBORHOOD',
          beforeData: { neighborhoodId: group.before.get(streetId) ?? null },
          afterData: { neighborhoodId: group.neighborhoodId },
        });
      }
      updated += group.streetIds.length;
    }

    if (auditRows.length > 0) {
      await this.prisma.auditLog.createMany({ data: auditRows });
    }

    return { updated, errors, total: items.length };
  }

  async unassignFromMicroarea(dto: UnassignStreetsDto, userId: string) {
    const streets = await this.prisma.street.findMany({
      where: { id: { in: dto.streetIds }, microareaId: { not: null } },
      select: { id: true, microareaId: true, municipalityId: true },
    });

    if (streets.length === 0) {
      return { cleared: 0 };
    }

    const affectedMicroareas = new Set(
      streets.map((s) => s.microareaId).filter((id): id is string => !!id),
    );

    await this.prisma.street.updateMany({
      where: { id: { in: streets.map((s) => s.id) } },
      data: { microareaId: null },
    });

    await this.prisma.auditLog.createMany({
      data: streets.map((street) => ({
        userId,
        entityType: 'street',
        entityId: street.id,
        action: 'UNASSIGN_MICROAREA',
        beforeData: { microareaId: street.microareaId },
        afterData: { microareaId: null },
      })),
    });

    await this.updateAffectedEnvelopes(affectedMicroareas);

    if (streets.length > 0) {
      invalidateDashboardIndicators(streets[0].municipalityId);
    }

    return { cleared: streets.length };
  }

  async clearAllAssignments(municipalityId: string, userId: string) {
    const painted = await this.prisma.street.findMany({
      where: { municipalityId, microareaId: { not: null } },
      select: { id: true, microareaId: true },
    });

    if (painted.length === 0) {
      return { cleared: 0 };
    }

    const affectedMicroareas = new Set(
      painted.map((s) => s.microareaId).filter((id): id is string => !!id),
    );

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

    await this.rebuildMunicipalityEnvelopes(municipalityId);

    invalidateDashboardIndicators(municipalityId);

    return { cleared: painted.length };
  }

  async updateDemographics(
    id: string,
    dto: UpdateStreetDemographicsDto,
    userId: string,
  ) {
    const street = await this.prisma.street.findUnique({ where: { id } });
    if (!street) throw new NotFoundException('Rua não encontrada');

    const data: {
      familyCount?: number;
      inhabitantCount?: number;
      propertyCount?: number;
      notes?: string;
    } = {};
    if (dto.familyCount !== undefined) data.familyCount = dto.familyCount;
    if (dto.inhabitantCount !== undefined) data.inhabitantCount = dto.inhabitantCount;
    if (dto.propertyCount !== undefined) data.propertyCount = dto.propertyCount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (Object.keys(data).length === 0) {
      return { ...street, osmId: street.osmId?.toString() ?? null };
    }

    const updated = await this.prisma.street.update({
      where: { id },
      data,
    });

    await this.audit.log({
      userId,
      entityType: 'street',
      entityId: id,
      action: 'UPDATE_DEMOGRAPHICS',
      beforeData: {
        familyCount: street.familyCount,
        inhabitantCount: street.inhabitantCount,
        propertyCount: street.propertyCount,
        notes: street.notes,
      },
      afterData: data,
    });

    return { ...updated, osmId: updated.osmId?.toString() ?? null };
  }

  async bulkUpdateDemographics(
    municipalityId: string,
    items: Array<{
      streetRef: string;
      familyCount: number;
      inhabitantCount: number;
      propertyCount?: number;
    }>,
    userId: string,
  ) {
    const streets = await this.prisma.street.findMany({
      where: { municipalityId },
      select: { id: true, name: true, familyCount: true, inhabitantCount: true, propertyCount: true },
    });

    let updated = 0;
    const errors: Array<{ row: number; streetRef: string; message: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = i + 1;
      const ref = item.streetRef.trim().toLowerCase();
      let matched = streets.filter((s) => s.name.toLowerCase() === ref);
      if (matched.length === 0) {
        const partial = streets.filter((s) => s.name.toLowerCase().includes(ref));
        if (partial.length === 1) {
          matched = partial;
        } else if (partial.length > 1) {
          errors.push({
            row,
            streetRef: item.streetRef,
            message: 'Nome de rua ambíguo — refine o nome',
          });
          continue;
        }
      }

      if (matched.length === 0) {
        errors.push({ row, streetRef: item.streetRef, message: 'Rua não encontrada' });
        continue;
      }

      for (const street of matched) {
        const data: {
          familyCount: number;
          inhabitantCount: number;
          propertyCount?: number;
        } = {
          familyCount: item.familyCount,
          inhabitantCount: item.inhabitantCount,
        };
        if (item.propertyCount !== undefined) data.propertyCount = item.propertyCount;

        if (
          street.familyCount === data.familyCount &&
          street.inhabitantCount === data.inhabitantCount &&
          (data.propertyCount === undefined || street.propertyCount === data.propertyCount)
        ) {
          continue;
        }

        await this.prisma.street.update({
          where: { id: street.id },
          data,
        });
        await this.audit.log({
          userId,
          entityType: 'street',
          entityId: street.id,
          action: 'UPDATE_DEMOGRAPHICS',
          beforeData: {
            familyCount: street.familyCount,
            inhabitantCount: street.inhabitantCount,
            propertyCount: street.propertyCount,
          },
          afterData: data,
        });
        updated++;
      }
    }

    return { updated, errors, total: items.length };
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

  private parseBbox(
    bbox?: string,
    minLat?: number,
    maxLat?: number,
    minLng?: number,
    maxLng?: number,
  ): { west: number; south: number; east: number; north: number } | null {
    if (bbox) {
      const parts = bbox.split(',').map((v) => Number(v.trim()));
      if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
        return { west: parts[0], south: parts[1], east: parts[2], north: parts[3] };
      }
    }
    if (
      minLat != null &&
      maxLat != null &&
      minLng != null &&
      maxLng != null &&
      [minLat, maxLat, minLng, maxLng].every((n) => Number.isFinite(n))
    ) {
      return { west: minLng, south: minLat, east: maxLng, north: maxLat };
    }
    return null;
  }

  private async findMapStreetsInBbox(
    municipalityId: string,
    options: {
      bbox: { west: number; south: number; east: number; north: number };
      page: number;
      limit: number;
      geoPrecision: number;
      microareaId?: string;
      neighborhoodId?: string;
      search?: string;
    },
  ) {
    const { bbox, page, limit, geoPrecision } = options;
    const skip = (page - 1) * limit;
    const envelope = `ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326)`;
    const intersects = `(
      (s.geom IS NOT NULL AND s.geom && ${envelope})
      OR (s.geom IS NULL AND ST_Intersects(
        ST_SetSRID(ST_GeomFromGeoJSON(s.geojson::text), 4326),
        ${envelope}
      ))
    )`;

    const filters: string[] = [
      `s.municipality_id = '${municipalityId}'::uuid`,
      's.osm_id IS NOT NULL',
      intersects,
    ];
    if (options.microareaId) {
      filters.push(`s.microarea_id = '${options.microareaId}'::uuid`);
    }
    if (options.neighborhoodId) {
      filters.push(`s.neighborhood_id = '${options.neighborhoodId}'::uuid`);
    }
    if (options.search?.trim()) {
      const q = options.search.trim().replace(/'/g, "''");
      filters.push(`s.name ILIKE '%${q}%'`);
    }
    const whereSql = filters.join(' AND ');

    type BboxRow = {
      id: string;
      name: string;
      street_type: string | null;
      microarea_id: string | null;
      neighborhood_id: string | null;
      osm_id: bigint | null;
      geojson: unknown;
      family_count: number;
      inhabitant_count: number;
      property_count: number;
      ma_id: string | null;
      ma_name: string | null;
      ma_number: number | null;
      ma_color: string | null;
      n_id: string | null;
      n_name: string | null;
    };

    const [rows, countResult] = await withDbRetry(() =>
      Promise.all([
        this.prisma.$queryRawUnsafe<BboxRow[]>(`
          SELECT s.id, s.name, s.street_type, s.microarea_id, s.neighborhood_id,
            s.osm_id, s.geojson, s.family_count, s.inhabitant_count, s.property_count,
            m.id AS ma_id, m.name AS ma_name, m.number AS ma_number, m.color AS ma_color,
            n.id AS n_id, n.name AS n_name
          FROM streets s
          LEFT JOIN microareas m ON m.id = s.microarea_id
          LEFT JOIN neighborhoods n ON n.id = s.neighborhood_id
          WHERE ${whereSql}
          ORDER BY s.name ASC
          LIMIT ${limit} OFFSET ${skip}
        `),
        this.prisma.$queryRawUnsafe<Array<{ count: bigint }>>(`
          SELECT COUNT(*)::bigint AS count FROM streets s WHERE ${whereSql}
        `),
      ]),
    );

    const total = Number(countResult[0]?.count ?? 0);
    const items = rows.map((s) => ({
      id: s.id,
      name: s.name,
      streetType: s.street_type,
      microareaId: s.microarea_id,
      neighborhoodId: s.neighborhood_id,
      osmId: s.osm_id?.toString() ?? null,
      geojson: compactLineStringGeojson(s.geojson, geoPrecision),
      familyCount: s.family_count ?? 0,
      inhabitantCount: s.inhabitant_count ?? 0,
      propertyCount: s.property_count ?? 0,
      updatedAt: new Date(0).toISOString(),
      microarea: s.ma_id
        ? { id: s.ma_id, name: s.ma_name!, number: s.ma_number!, color: s.ma_color! }
        : undefined,
      neighborhood: s.n_id ? { id: s.n_id, name: s.n_name! } : undefined,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async updateAffectedEnvelopes(microareaIds: Iterable<string>) {
    const ids = [...new Set(Array.from(microareaIds).filter(Boolean))];
    if (ids.length === 0) return;
    await Promise.all(ids.map((microareaId) => this.updateMicroareaEnvelope(microareaId)));
  }

  private async rebuildMunicipalityEnvelopes(municipalityId: string) {
    const microareas = await this.prisma.microarea.findMany({
      where: { municipalityId },
      select: { id: true },
    });
    await this.updateAffectedEnvelopes(microareas.map((m) => m.id));
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
