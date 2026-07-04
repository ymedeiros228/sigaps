import { Injectable, NotFoundException } from '@nestjs/common';
import circle from '@turf/circle';
import { PrismaService } from '../../prisma/prisma.service';
import { PaintCircleDto } from './dto/paint-circle.dto';

@Injectable()
export class PaintZonesService {
  constructor(private readonly prisma: PrismaService) {}

  listByMunicipality(municipalityId: string) {
    return this.prisma.microareaPaintZone.findMany({
      where: { municipalityId },
      orderBy: { createdAt: 'asc' },
      include: {
        microarea: { select: { id: true, name: true, color: true, number: true } },
      },
    });
  }

  async createCircle(municipalityId: string, dto: PaintCircleDto) {
    const microarea = await this.prisma.microarea.findFirst({
      where: { id: dto.microareaId, municipalityId },
    });
    if (!microarea) {
      throw new NotFoundException('Microárea não encontrada.');
    }

    const geojson = circle([dto.centerLng, dto.centerLat], dto.radiusMeters / 1000, {
      steps: 64,
      units: 'kilometers',
    }).geometry;

    return this.prisma.microareaPaintZone.create({
      data: {
        name: dto.name?.trim() || null,
        microareaId: dto.microareaId,
        municipalityId,
        centerLat: dto.centerLat,
        centerLng: dto.centerLng,
        radiusMeters: dto.radiusMeters,
        geojson: geojson as object,
      },
      include: {
        microarea: { select: { id: true, name: true, color: true, number: true } },
      },
    });
  }

  async clearByMunicipality(municipalityId: string) {
    const result = await this.prisma.microareaPaintZone.deleteMany({ where: { municipalityId } });
    return { count: result.count };
  }

  async remove(id: string) {
    const zone = await this.prisma.microareaPaintZone.findUnique({ where: { id } });
    if (!zone) throw new NotFoundException('Divisão não encontrada.');
    await this.prisma.microareaPaintZone.delete({ where: { id } });
    return { removed: true };
  }
}
