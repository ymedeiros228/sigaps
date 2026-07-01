import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
}
