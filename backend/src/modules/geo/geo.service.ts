import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { kml } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportGeoJsonDto } from './dto/import-geojson.dto';

type LineFeature = GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importGeoJson(municipalityId: string, dto: ImportGeoJsonDto) {
    await this.prisma.municipality.findUniqueOrThrow({ where: { id: municipalityId } });

    const features = this.extractLineFeatures(dto.geojson);
    if (!features.length) {
      throw new BadRequestException('Nenhuma geometria LineString encontrada no GeoJSON');
    }

    const microareas = await this.prisma.microarea.findMany({
      where: { municipalityId },
      select: { id: true, name: true, number: true },
    });

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const feature of features) {
      const lineStrings = this.toLineStrings(feature.geometry);
      for (const line of lineStrings) {
        if (line.coordinates.length < 2) {
          skipped++;
          continue;
        }

        const props = (feature.properties ?? {}) as Record<string, unknown>;
        const name = String(
          props.name ?? props.nome ?? props.NOME ?? props.street ?? 'Via importada',
        );
        const streetType = props.streetType
          ? String(props.streetType)
          : this.inferStreetType(name);
        const microareaId = this.resolveMicroareaId(props, microareas);
        const geojson = { type: 'LineString' as const, coordinates: line.coordinates };

        if (dto.updateByName) {
          const existing = await this.prisma.street.findFirst({
            where: { municipalityId, name },
          });
          if (existing) {
            await this.prisma.street.update({
              where: { id: existing.id },
              data: { geojson, streetType, microareaId: microareaId ?? existing.microareaId },
            });
            updated++;
            continue;
          }
        }

        await this.prisma.street.create({
          data: {
            name,
            streetType,
            municipalityId,
            microareaId,
            geojson,
          },
        });
        imported++;
      }
    }

    if (microareas.length) {
      const affected = new Set(
        features
          .map((f) => this.resolveMicroareaId((f.properties ?? {}) as Record<string, unknown>, microareas))
          .filter(Boolean),
      );
      for (const id of affected) {
        await this.prisma.$executeRaw`SELECT update_microarea_envelope(${id}::uuid)`;
      }
    }

    this.logger.log(`GeoJSON import: ${imported} novas, ${updated} atualizadas, ${skipped} ignoradas`);
    return { imported, updated, skipped, total: features.length };
  }

  async importKml(municipalityId: string, kmlContent: string, updateByName = false) {
    const dom = new DOMParser().parseFromString(kmlContent, 'text/xml');
    const geojson = kml(dom) as GeoJSON.FeatureCollection;
    return this.importGeoJson(municipalityId, { geojson, updateByName });
  }

  async importCsv(municipalityId: string, csvContent: string, updateByName = false) {
    const rows = this.parseCsvRows(csvContent);
    if (!rows.length) {
      throw new BadRequestException('CSV vazio ou formato inválido');
    }

    const features: LineFeature[] = [];
    for (const row of rows) {
      const coords = this.csvRowToCoordinates(row);
      if (coords.length < 2) continue;

      features.push({
        type: 'Feature',
        properties: {
          name: row.name ?? row.nome ?? 'Via importada',
          streetType: row.street_type ?? row.tipo,
          microareaName: row.microarea_name ?? row.microarea,
          microareaNumber: row.microarea_number,
        },
        geometry: { type: 'LineString', coordinates: coords },
      });
    }

    if (!features.length) {
      throw new BadRequestException(
        'Nenhuma rua válida no CSV. Use colunas: name, lon1, lat1, lon2, lat2 (ou coordinates como JSON)',
      );
    }

    return this.importGeoJson(municipalityId, {
      geojson: { type: 'FeatureCollection', features },
      updateByName,
    });
  }

  async exportGeoJson(municipalityId: string, microareaId?: string) {
    const streets = await this.prisma.street.findMany({
      where: {
        municipalityId,
        ...(microareaId ? { microareaId } : {}),
      },
      include: {
        microarea: { select: { id: true, name: true, number: true, color: true } },
        neighborhood: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    const features: GeoJSON.Feature[] = streets.map((street) => ({
      type: 'Feature',
      properties: {
        id: street.id,
        name: street.name,
        streetType: street.streetType,
        microareaId: street.microareaId,
        microareaName: street.microarea?.name,
        microareaNumber: street.microarea?.number,
        microareaColor: street.microarea?.color,
        neighborhood: street.neighborhood?.name,
        lengthMeters: street.lengthMeters,
        familyCount: street.familyCount,
        inhabitantCount: street.inhabitantCount,
      },
      geometry: street.geojson as unknown as GeoJSON.LineString,
    }));

    const municipality = await this.prisma.municipality.findUniqueOrThrow({
      where: { id: municipalityId },
    });

    return {
      type: 'FeatureCollection',
      features,
      metadata: {
        name: `SIGAPS - ${municipality.name}/${municipality.state}`,
        exportedAt: new Date().toISOString(),
      },
    };
  }

  async exportMicroareasGeoJson(municipalityId: string) {
    const microareas = await this.prisma.microarea.findMany({
      where: { municipalityId },
      orderBy: { number: 'asc' },
    });

    const features: GeoJSON.Feature[] = [];
    for (const ma of microareas) {
      const result = await this.prisma.$queryRaw<Array<{ geojson: string | null }>>`
        SELECT ST_AsGeoJSON(envelope_geom)::text as geojson
        FROM microareas WHERE id = ${ma.id}::uuid
      `;
      if (result[0]?.geojson) {
        features.push({
          type: 'Feature',
          properties: {
            id: ma.id,
            name: ma.name,
            number: ma.number,
            color: ma.color,
          },
          geometry: JSON.parse(result[0].geojson),
        });
      }
    }

    return { type: 'FeatureCollection', features } satisfies GeoJSON.FeatureCollection;
  }

  private extractLineFeatures(
    geojson: GeoJSON.Feature | GeoJSON.FeatureCollection,
  ): LineFeature[] {
    if (geojson.type === 'FeatureCollection') {
      return (geojson.features ?? []).filter(
        (f): f is LineFeature =>
          f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString',
      );
    }
    if (
      geojson.type === 'Feature' &&
      (geojson.geometry?.type === 'LineString' ||
        geojson.geometry?.type === 'MultiLineString')
    ) {
      return [geojson as LineFeature];
    }
    throw new BadRequestException('GeoJSON deve ser Feature ou FeatureCollection');
  }

  private toLineStrings(
    geometry: GeoJSON.LineString | GeoJSON.MultiLineString,
  ): GeoJSON.LineString[] {
    if (geometry.type === 'LineString') return [geometry];
    return geometry.coordinates.map((coords) => ({
      type: 'LineString',
      coordinates: coords,
    }));
  }

  private resolveMicroareaId(
    props: Record<string, unknown>,
    microareas: Array<{ id: string; name: string; number: number }>,
  ): string | undefined {
    if (typeof props.microareaId === 'string') return props.microareaId;
    if (typeof props.microareaName === 'string') {
      return microareas.find(
        (m) => m.name.toLowerCase() === String(props.microareaName).toLowerCase(),
      )?.id;
    }
    if (props.microareaNumber != null) {
      const num = Number(props.microareaNumber);
      return microareas.find((m) => m.number === num)?.id;
    }
    return undefined;
  }

  private inferStreetType(name: string) {
    const lower = name.toLowerCase();
    if (lower.includes('avenida') || lower.startsWith('av ')) return 'Avenida';
    if (lower.includes('travessa') || lower.startsWith('tv ')) return 'Travessa';
    if (lower.includes('rodovia')) return 'Rodovia';
    return 'Rua';
  }

  private parseCsvRows(content: string): Array<Record<string, string>> {
    const lines = content.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 1) return [];

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = this.parseCsvLine(lines[0], delimiter).map((h) => h.trim().toLowerCase());
    const hasHeader = headers.some((h) =>
      ['name', 'nome', 'lon1', 'lat1', 'coordinates'].includes(h),
    );

    const startIdx = hasHeader ? 1 : 0;
    const defaultHeaders = ['name', 'street_type', 'lon1', 'lat1', 'lon2', 'lat2', 'microarea_name'];
    const cols = hasHeader ? headers : defaultHeaders;

    const rows: Array<Record<string, string>> = [];
    for (let i = startIdx; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i], delimiter);
      const row: Record<string, string> = {};
      cols.forEach((col, idx) => {
        if (values[idx] != null) row[col] = values[idx].trim();
      });
      if (row.name || row.nome) rows.push(row);
    }
    return rows;
  }

  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }

  private csvRowToCoordinates(row: Record<string, string>): number[][] {
    if (row.coordinates) {
      try {
        const parsed = JSON.parse(row.coordinates) as number[][];
        if (Array.isArray(parsed) && parsed.every((p) => p.length >= 2)) {
          return parsed.map(([lon, lat]) => [Number(lon), Number(lat)]);
        }
      } catch {
        /* fall through */
      }
    }

    const lon1 = Number(row.lon1 ?? row.longitude1 ?? row.lng1);
    const lat1 = Number(row.lat1 ?? row.latitude1);
    const lon2 = Number(row.lon2 ?? row.longitude2 ?? row.lng2);
    const lat2 = Number(row.lat2 ?? row.latitude2);

    if ([lon1, lat1, lon2, lat2].every((n) => !Number.isNaN(n))) {
      return [
        [lon1, lat1],
        [lon2, lat2],
      ];
    }
    return [];
  }
}
