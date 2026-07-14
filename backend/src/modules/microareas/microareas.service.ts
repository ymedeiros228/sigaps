import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { maskCpfField } from '../../common/utils/mask-cpf.util';
import { applyAcsMicroareaScope, type AuthViewer } from '../../common/utils/acs-scope.util';
import { AcsService } from '../acs/acs.service';
import { CreateMicroareaDto, UpdateMicroareaDto } from './dto/microarea.dto';

@Injectable()
export class MicroareasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly acsService: AcsService,
  ) {}

  async findByMunicipality(municipalityId: string, viewer?: AuthViewer) {
    const scopedId = await applyAcsMicroareaScope(this.prisma, viewer, undefined);
    if (scopedId === '__none__') return [];

    return this.prisma.microarea.findMany({
      where: {
        municipalityId,
        ...(scopedId ? { id: scopedId } : {}),
      },
      include: {
        acs: { select: { id: true, name: true, phone: true, photoUrl: true } },
        ubs: { select: { id: true, name: true } },
        neighborhood: { select: { id: true, name: true } },
        _count: { select: { streets: true } },
      },
      orderBy: { number: 'asc' },
    });
  }

  async findOne(id: string, viewerRole?: string) {
    const microarea = await this.prisma.microarea.findUnique({
      where: { id },
      include: {
        acs: true,
        ubs: true,
        neighborhood: true,
        streets: {
          select: {
            id: true,
            name: true,
            lengthMeters: true,
          },
        },
      },
    });
    if (!microarea) throw new NotFoundException('Microárea não encontrada');
    if (microarea.acs) {
      return {
        ...microarea,
        acs: {
          ...microarea.acs,
          cpf: maskCpfField(microarea.acs.cpf, viewerRole) ?? microarea.acs.cpf,
        },
      };
    }
    return microarea;
  }

  async getEnvelopeGeoJson(id: string) {
    try {
      const result = await this.prisma.$queryRaw<
        Array<{ geojson: string | null }>
      >`
        SELECT ST_AsGeoJSON(envelope_geom)::text as geojson
        FROM microareas WHERE id = ${id}::uuid
      `;
      if (!result[0]?.geojson) return null;
      return JSON.parse(result[0].geojson);
    } catch {
      return null;
    }
  }

  async listEnvelopesByMunicipality(municipalityId: string) {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          color: string;
          number: number;
          geojson: string | null;
          label_lng: number | null;
          label_lat: number | null;
        }>
      >`
        SELECT m.id, m.name, m.color, m.number,
          ST_AsGeoJSON(m.envelope_geom)::text AS geojson,
          ST_X(ST_Centroid(m.envelope_geom)) AS label_lng,
          ST_Y(ST_Centroid(m.envelope_geom)) AS label_lat
        FROM microareas m
        WHERE m.municipality_id = ${municipalityId}::uuid
          AND m.envelope_geom IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM streets s WHERE s.microarea_id = m.id
          )
        ORDER BY m.number ASC
      `;
      return rows
        .filter((r) => r.geojson)
        .map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          number: r.number,
          geometry: JSON.parse(r.geojson!) as GeoJSON.Polygon | GeoJSON.MultiPolygon,
          labelLat: r.label_lat,
          labelLng: r.label_lng,
        }));
    } catch {
      return [];
    }
  }

  async rebuildEnvelopes(municipalityId: string) {
    await this.prisma.municipality.findUniqueOrThrow({ where: { id: municipalityId } });

    const microareas = await this.prisma.microarea.findMany({
      where: { municipalityId },
      select: { id: true },
    });

    for (const microarea of microareas) {
      try {
        await this.prisma.$executeRaw`
          SELECT update_microarea_envelope(${microarea.id}::uuid)
        `;
      } catch {
        /* PostGIS opcional */
      }
    }

    try {
      await this.prisma.$executeRaw`
        UPDATE microareas
        SET envelope_geom = NULL
        WHERE municipality_id = ${municipalityId}::uuid
          AND NOT EXISTS (
            SELECT 1 FROM streets s WHERE s.microarea_id = microareas.id
          )
      `;
    } catch {
      /* ignora se coluna/função ausente */
    }

    return { rebuilt: microareas.length };
  }

  private microareaSnapshot(microarea: {
    number: number;
    name: string;
    color: string;
    ubsId?: string | null;
    acsId?: string | null;
    neighborhoodId?: string | null;
  }) {
    return auditSnapshot(microarea as Record<string, unknown>, [
      'number',
      'name',
      'color',
      'ubsId',
      'acsId',
      'neighborhoodId',
    ]);
  }

  private async validateLinks(
    municipalityId: string,
    links: { ubsId?: string | null; acsId?: string | null; neighborhoodId?: string | null },
  ) {
    if (links.ubsId) {
      const ubs = await this.prisma.ubs.findFirst({
        where: { id: links.ubsId, municipalityId },
      });
      if (!ubs) throw new BadRequestException('UBS não encontrada neste município.');
    }
    if (links.acsId) {
      const acs = await this.prisma.acs.findFirst({
        where: { id: links.acsId, municipalityId },
      });
      if (!acs) throw new BadRequestException('ACS não encontrado neste município.');
    }
    if (links.neighborhoodId) {
      const neighborhood = await this.prisma.neighborhood.findFirst({
        where: { id: links.neighborhoodId, municipalityId },
      });
      if (!neighborhood) throw new BadRequestException('Bairro não encontrado neste município.');
    }
  }

  private async ensureAcsExclusive(microareaId: string, acsId: string | null | undefined) {
    if (!acsId) return;
    await this.prisma.microarea.updateMany({
      where: { acsId, NOT: { id: microareaId } },
      data: { acsId: null },
    });
  }

  async create(dto: CreateMicroareaDto, userId: string) {
    const { municipalityId, ubsId, acsId, neighborhoodId, ...rest } = dto;
    await this.validateLinks(municipalityId, { ubsId, acsId, neighborhoodId });

    const microarea = await this.prisma.microarea.create({
      data: {
        ...rest,
        municipalityId,
        ubsId: ubsId ?? null,
        acsId: acsId ?? null,
        neighborhoodId: neighborhoodId ?? null,
      },
    });

    if (acsId) await this.ensureAcsExclusive(microarea.id, acsId);
    if (acsId) {
      await this.acsService.syncStreetCoverageForAcs({
        acsId,
        municipalityId,
        microareaId: microarea.id,
        userId,
      });
    }
    const result = await this.findOne(microarea.id);

    await this.audit.log({
      userId,
      entityType: 'microarea',
      entityId: microarea.id,
      action: 'CREATE',
      afterData: this.microareaSnapshot(result),
    });

    return result;
  }

  async update(id: string, dto: UpdateMicroareaDto, userId: string) {
    const before = await this.findOne(id);
    const municipalityId = dto.municipalityId ?? before.municipalityId;

    const ubsId = dto.ubsId !== undefined ? dto.ubsId : before.ubsId;
    const acsId = dto.acsId !== undefined ? dto.acsId : before.acsId;
    const neighborhoodId =
      dto.neighborhoodId !== undefined ? dto.neighborhoodId : before.neighborhoodId;

    await this.validateLinks(municipalityId, { ubsId, acsId, neighborhoodId });

    if (dto.acsId !== undefined) {
      await this.ensureAcsExclusive(id, dto.acsId);
    }

    const { municipalityId: _m, ...data } = dto;
    await this.prisma.microarea.update({
      where: { id },
      data: {
        ...data,
        ubsId: dto.ubsId !== undefined ? (dto.ubsId ?? null) : undefined,
        acsId: dto.acsId !== undefined ? (dto.acsId ?? null) : undefined,
        neighborhoodId:
          dto.neighborhoodId !== undefined ? (dto.neighborhoodId ?? null) : undefined,
      },
    });
    if (acsId) {
      await this.acsService.syncStreetCoverageForAcs({
        acsId,
        municipalityId,
        microareaId: id,
        userId,
        transferFromMicroareaIds:
          before.acsId && before.acsId === acsId ? [id] : [],
      });
    }

    const result = await this.findOne(id);

    await this.audit.log({
      userId,
      entityType: 'microarea',
      entityId: id,
      action: 'UPDATE',
      beforeData: this.microareaSnapshot(before),
      afterData: this.microareaSnapshot(result),
    });

    return result;
  }

  async remove(id: string, userId: string) {
    const before = await this.findOne(id);
    await this.prisma.street.updateMany({
      where: { microareaId: id },
      data: { microareaId: null },
    });
    await this.prisma.microarea.delete({ where: { id } });

    await this.audit.log({
      userId,
      entityType: 'microarea',
      entityId: id,
      action: 'DELETE',
      beforeData: this.microareaSnapshot(before),
    });

    return { ok: true };
  }
}
