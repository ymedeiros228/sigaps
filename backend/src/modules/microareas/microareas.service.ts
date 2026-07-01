import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(dto: CreateMicroareaDto) {
    return this.prisma.microarea.create({ data: dto });
  }

  async update(id: string, dto: UpdateMicroareaDto) {
    return this.prisma.microarea.update({ where: { id }, data: dto });
  }
}
