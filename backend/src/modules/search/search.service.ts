import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildStreetSearchWhere } from '../../common/utils/street-search.util';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(municipalityId: string, query: string) {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { streets: [], neighborhoods: [], places: [], ubs: [], acs: [], microareas: [] };
    }

    const contains = { contains: q, mode: 'insensitive' as const };

    const [streets, neighborhoods, places, ubs, acs, microareas] = await Promise.all([
      this.prisma.street.findMany({
        where: {
          ...buildStreetSearchWhere(municipalityId, q),
          osmId: { not: null },
          NOT: { name: { startsWith: 'Via OSM' } },
        },
        take: 25,
        select: {
          id: true,
          name: true,
          streetType: true,
          geojson: true,
          microarea: { select: { id: true, name: true, color: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.neighborhood.findMany({
        where: { municipalityId, name: contains },
        take: 10,
        select: { id: true, name: true, _count: { select: { streets: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.place.findMany({
        where: { municipalityId, name: contains },
        take: 12,
        select: { id: true, name: true, kind: true, latitude: true, longitude: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ubs.findMany({
        where: { municipalityId, name: contains },
        take: 10,
        select: { id: true, name: true, address: true, latitude: true, longitude: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.acs.findMany({
        where: { municipalityId, name: contains, status: 'ATIVO' },
        take: 10,
        select: {
          id: true,
          name: true,
          phone: true,
          microarea: { select: { id: true, name: true, color: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.microarea.findMany({
        where: { municipalityId, name: contains },
        take: 10,
        select: { id: true, name: true, number: true, color: true },
        orderBy: { number: 'asc' },
      }),
    ]);

    return { streets, neighborhoods, places, ubs, acs, microareas };
  }
}
