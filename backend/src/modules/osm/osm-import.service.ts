import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface OverpassElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
}

@Injectable()
export class OsmImportService {
  private readonly logger = new Logger(OsmImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async importStreetsForMunicipality(municipalityId: string) {
    const municipality = await this.prisma.municipality.findUniqueOrThrow({
      where: { id: municipalityId },
    });

    const bbox = await this.getBoundingBox(
      municipality.name,
      municipality.state,
    );
    if (!bbox) {
      throw new Error(
        `Não foi possível obter limites geográficos para ${municipality.name}`,
      );
    }

    const overpassUrl = this.config.get<string>(
      'OVERPASS_URL',
      'https://overpass-api.de/api/interpreter',
    );

    const query = `
      [out:json][timeout:120];
      (
        way["highway"~"^(primary|secondary|tertiary|residential|unclassified|living_street|service|track)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      );
      out geom;
    `;

    const response = await fetch(overpassUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data = (await response.json()) as { elements: OverpassElement[] };
    let imported = 0;
    let skipped = 0;

    for (const element of data.elements) {
      if (!element.geometry || element.geometry.length < 2) {
        skipped++;
        continue;
      }

      const name =
        element.tags?.['name'] ||
        element.tags?.['addr:street'] ||
        `Via OSM ${element.id}`;

      const coordinates = element.geometry.map((p) => [p.lon, p.lat]);
      const geojson = {
        type: 'LineString',
        coordinates,
      };

      const streetType = this.inferStreetType(name, element.tags);

      await this.prisma.street.upsert({
        where: { osmId: BigInt(element.id) },
        create: {
          osmId: BigInt(element.id),
          name,
          streetType,
          municipalityId,
          geojson,
        },
        update: {
          name,
          streetType,
          geojson,
        },
      });
      imported++;
    }

    this.logger.log(
      `Importação concluída: ${imported} ruas, ${skipped} ignoradas`,
    );
    return { imported, skipped, total: data.elements.length };
  }

  private async getBoundingBox(city: string, state: string) {
    const nominatimUrl = this.config.get<string>(
      'NOMINATIM_URL',
      'https://nominatim.openstreetmap.org',
    );
    const url = `${nominatimUrl}/search?city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&country=Brazil&format=json&limit=1`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SIGAPS/1.0 (APS Passagem Franca)' },
    });
    const results = (await response.json()) as Array<{ boundingbox: string[] }>;
    if (!results.length) return null;

    const [south, north, west, east] = results[0].boundingbox.map(Number);
    return { south, north, west, east };
  }

  private inferStreetType(name: string, tags?: Record<string, string>) {
    const lower = name.toLowerCase();
    if (lower.includes('avenida') || lower.startsWith('av ')) return 'Avenida';
    if (lower.includes('travessa') || lower.startsWith('tv ')) return 'Travessa';
    if (lower.includes('rodovia')) return 'Rodovia';
    if (tags?.highway === 'primary') return 'Via Principal';
    return 'Rua';
  }
}
