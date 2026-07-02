import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMicroareaDto, UpdateMicroareaDto } from './dto/microarea.dto';

@Injectable()
export class MicroareasService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMunicipality(municipalityId: string) {
    return this.prisma.microarea.findMany({
      where: { municipalityId },
      include: {
        acs: { select: { id: true, name: true, phone: true, photoUrl: true } },
        ubs: { select: { id: true, name: true } },
        neighborhood: { select: { id: true, name: true } },
        _count: { select: { streets: true } },
      },
      orderBy: { number: 'asc' },
    });
  }

  async findOne(id: string) {
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
            geojson: true,
            lengthMeters: true,
          },
        },
      },
    });
    if (!microarea) throw new NotFoundException('Microárea não encontrada');
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

  async create(dto: CreateMicroareaDto) {
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
    return this.findOne(microarea.id);
  }

  async update(id: string, dto: UpdateMicroareaDto) {
    const current = await this.findOne(id);
    const municipalityId = dto.municipalityId ?? current.municipalityId;

    const ubsId = dto.ubsId !== undefined ? dto.ubsId : current.ubsId;
    const acsId = dto.acsId !== undefined ? dto.acsId : current.acsId;
    const neighborhoodId =
      dto.neighborhoodId !== undefined ? dto.neighborhoodId : current.neighborhoodId;

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

    return this.findOne(id);
  }
}
