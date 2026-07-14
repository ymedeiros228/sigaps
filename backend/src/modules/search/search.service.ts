import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildStreetSearchWhere } from '../../common/utils/street-search.util';
import { compactLineStringGeojson } from '../../common/utils/compact-geojson';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  private stripSearchPrefix(query: string) {
    return query
      .trim()
      .replace(
        /^(ubs|u\.?b\.?s\.?|unidade\s+basica\s+de\s+saude|unidade\s+basica|povoado|localidade|distrito|acs|agente\s+comunitario\s+de\s+saude|agente\s+comunitario|microarea|microárea|bairro)\s+/i,
        '',
      )
      .trim();
  }

  private buildContainsVariants(query: string) {
    const stripped = this.stripSearchPrefix(query);
    const variants = [query.trim()];
    if (stripped.length >= 2 && stripped.toLowerCase() !== query.trim().toLowerCase()) {
      variants.push(stripped);
    }
    return variants
      .filter((value) => value.length >= 2)
      .map((value) => ({ contains: value, mode: 'insensitive' as const }));
  }

  async search(municipalityId: string, query: string) {
    const q = query.trim();
    if (!q || q.length < 2) {
      return { streets: [], neighborhoods: [], places: [], ubs: [], acs: [], microareas: [] };
    }

    const containsVariants = this.buildContainsVariants(q);
    const containsWhere = containsVariants.map((value) => ({ name: value }));

    const [streets, neighborhoods, places, ubs, acs, microareas] = await Promise.all([
      this.prisma.street
        .findMany({
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
        })
        .then((rows) =>
          rows.map((s) => ({
            ...s,
            // Typeahead só precisa de geometria fina p/ flyTo — corta payload.
            geojson: compactLineStringGeojson(s.geojson, 4),
          })),
        ),
      this.prisma.neighborhood.findMany({
        where: { municipalityId, OR: containsWhere },
        take: 10,
        select: { id: true, name: true, _count: { select: { streets: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.place.findMany({
        where: { municipalityId, OR: containsWhere },
        take: 12,
        select: { id: true, name: true, kind: true, latitude: true, longitude: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ubs.findMany({
        where: { municipalityId, OR: containsWhere },
        take: 10,
        select: { id: true, name: true, address: true, latitude: true, longitude: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.acs.findMany({
        where: { municipalityId, OR: containsWhere, status: 'ATIVO' },
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
        where: { municipalityId, OR: containsWhere },
        take: 10,
        select: { id: true, name: true, number: true, color: true },
        orderBy: { number: 'asc' },
      }),
    ]);

    return { streets, neighborhoods, places, ubs, acs, microareas };
  }
}
