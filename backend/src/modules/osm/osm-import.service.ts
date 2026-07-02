import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { importStreetsFromBundledGeoJson } from '../../common/utils/bundled-streets.import';
import { withDbRetry } from '../../common/utils/prisma-retry.util';
import {
  fixLineStringCoordinates,
  isValidBrazilCoord,
} from '../../common/utils/geojson.util';
import {
  HIGHWAY_FILTER,
  inferStreetType,
  resolveOsmStreetName,
} from '../../common/utils/osm-street.util';

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

type StreetUpsert = {
  osmId: bigint;
  name: string;
  streetType: string;
  municipalityId: string;
  neighborhoodId?: string;
  geojson: { type: 'LineString'; coordinates: number[][] };
};

const BATCH_SIZE = 40;

@Injectable()
export class OsmImportService {
  private readonly logger = new Logger(OsmImportService.name);
  private static readonly importLocks = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async importStreetsForMunicipality(municipalityId: string) {
    if (OsmImportService.importLocks.has(municipalityId)) {
      const currentCount = await this.prisma.street.count({
        where: { municipalityId, osmId: { not: null } },
      });
      return {
        imported: 0,
        skipped: 0,
        total: 0,
        status: 'in_progress' as const,
        currentCount,
      };
    }

    OsmImportService.importLocks.add(municipalityId);
    try {
      const municipality = await withDbRetry(() =>
        this.prisma.municipality.findUnique({
          where: { id: municipalityId },
        }),
      );
      if (!municipality) {
        throw new NotFoundException('Município não encontrado.');
      }

      const existing = await withDbRetry(() =>
        this.prisma.street.count({
          where: { municipalityId, osmId: { not: null } },
        }),
      );

      const bundled = await importStreetsFromBundledGeoJson(
        this.prisma,
        municipalityId,
        municipality.name,
        municipality.state,
      );

      if (bundled.imported > 0) {
        this.logger.log(
          `Ruas do pacote local: ${bundled.imported} (${bundled.path})`,
        );
        return {
          ...bundled,
          status: 'done' as const,
          osmRelationId: this.resolveOsmRelationId(municipality),
        };
      }

      if (existing > 0) {
        return {
          imported: 0,
          skipped: 0,
          total: existing,
          status: 'done' as const,
          source: 'database' as const,
        };
      }

      this.logger.log('Pacote local vazio — tentando Overpass (pode demorar)...');
      return await this.runOverpassImport(municipality);
    } finally {
      OsmImportService.importLocks.delete(municipalityId);
    }
  }

  private async runOverpassImport(municipality: {
    id: string;
    name: string;
    state: string;
    latitude: number;
    longitude: number;
    osmRelationId: number | null;
  }) {
    const relationId = this.resolveOsmRelationId(municipality);
    const queries: string[] = [this.buildBboxQuery(this.bboxFromMunicipality(municipality))];
    if (relationId) {
      queries.unshift(this.buildAreaQuery(relationId));
    }

    const overpassUrls = [
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      this.config.get<string>('OVERPASS_URL'),
      'https://overpass-api.de/api/interpreter',
    ].filter((url, i, arr): url is string => !!url && arr.indexOf(url) === i);

    let data: { elements: OverpassElement[] } | null = null;
    let lastError: unknown;

    outer: for (const query of queries) {
      for (const overpassUrl of overpassUrls) {
        try {
          data = await this.fetchOverpass(overpassUrl, query);
          if (data.elements.length > 0) break outer;
        } catch (err) {
          lastError = err;
          this.logger.warn(`Overpass falhou (${overpassUrl}): ${err}`);
        }
      }
    }

    if (!data || data.elements.length === 0) {
      if (lastError instanceof BadGatewayException || lastError instanceof ServiceUnavailableException) {
        throw lastError;
      }
      throw new BadGatewayException(
        'Serviço de mapas ocupado. As ruas locais já devem estar no sistema — recarregue a página.',
      );
    }

    const toUpsert: StreetUpsert[] = [];
    let skipped = 0;

    const neighborhoods = await this.prisma.neighborhood.findMany({
      where: { municipalityId: municipality.id },
      select: { id: true, name: true },
    });

    for (const element of data.elements) {
      if (!element.geometry || element.geometry.length < 2) {
        skipped++;
        continue;
      }

      const name = resolveOsmStreetName(element.tags, element.id);
      if (!name) {
        skipped++;
        continue;
      }

      const coordinates = fixLineStringCoordinates(
        element.geometry.map((p) => [p.lon, p.lat]),
      );
      const [lng0, lat0] = coordinates[0];
      if (!isValidBrazilCoord(lng0, lat0)) {
        skipped++;
        continue;
      }

      toUpsert.push({
        osmId: BigInt(element.id),
        name,
        streetType: inferStreetType(name, element.tags),
        municipalityId: municipality.id,
        neighborhoodId: this.resolveNeighborhoodFromTags(element.tags, neighborhoods),
        geojson: { type: 'LineString', coordinates },
      });
    }

    let imported = 0;
    for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
      const chunk = toUpsert.slice(i, i + BATCH_SIZE);
      await this.prisma.$transaction(
        chunk.map((street) =>
          this.prisma.street.upsert({
            where: { osmId: street.osmId },
            create: street,
            update: {
              name: street.name,
              streetType: street.streetType,
              geojson: street.geojson,
              ...(street.neighborhoodId ? { neighborhoodId: street.neighborhoodId } : {}),
            },
          }),
        ),
      );
      imported += chunk.length;
    }

    await this.prisma.street.deleteMany({
      where: { municipalityId: municipality.id, osmId: null },
    });

    this.logger.log(`Overpass: ${imported} ruas, ${skipped} ignoradas`);
    return {
      imported,
      skipped,
      total: data.elements.length,
      osmRelationId: relationId,
      status: 'done' as const,
      source: 'overpass' as const,
    };
  }

  private async fetchOverpass(
    overpassUrl: string,
    query: string,
  ): Promise<{ elements: OverpassElement[] }> {
    let response: Response;
    try {
      response = await fetch(overpassUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Não foi possível conectar ao serviço de mapas.',
      );
    }

    if (!response.ok) {
      throw new BadGatewayException('Serviço de mapas ocupado.');
    }

    return (await response.json()) as { elements: OverpassElement[] };
  }

  private bboxFromMunicipality(municipality: { latitude: number; longitude: number }) {
    const pad = 0.12;
    return {
      south: municipality.latitude - pad,
      north: municipality.latitude + pad,
      west: municipality.longitude - pad,
      east: municipality.longitude + pad,
    };
  }

  private resolveOsmRelationId(municipality: {
    name: string;
    state: string;
    osmRelationId: number | null;
  }): number | null {
    if (municipality.osmRelationId) return municipality.osmRelationId;
    if (municipality.name === 'Passagem Franca' && municipality.state === 'MA') {
      return Number(this.config.get('OSM_RELATION_ID_PASSAGEM_FRANCA') ?? 332931);
    }
    return null;
  }

  private buildAreaQuery(relationId: number): string {
    const areaId = 3_600_000_000 + relationId;
    return `
      [out:json][timeout:45];
      area(${areaId})->.municipio;
      ( way["highway"~"${HIGHWAY_FILTER}"](area.municipio); );
      out geom;
    `;
  }

  private buildBboxQuery(bbox: {
    south: number;
    north: number;
    west: number;
    east: number;
  }): string {
    return `
      [out:json][timeout:45];
      ( way["highway"~"${HIGHWAY_FILTER}"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}); );
      out geom;
    `;
  }

  private resolveNeighborhoodFromTags(
    tags: Record<string, string> | undefined,
    neighborhoods: Array<{ id: string; name: string }>,
  ): string | undefined {
    if (!tags || neighborhoods.length === 0) return undefined;
    const suburb =
      tags['addr:suburb'] ??
      tags['addr:neighbourhood'] ??
      tags['addr:quarter'] ??
      tags.suburb ??
      tags.neighbourhood;
    if (!suburb) return undefined;
    const q = suburb.trim().toLowerCase();
    return neighborhoods.find((n) => n.name.toLowerCase() === q)?.id;
  }
}
