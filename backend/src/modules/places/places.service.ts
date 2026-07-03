import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaceKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { searchNominatim } from '../../common/utils/nominatim.util';
import { CreatePlaceDto, UpdatePlaceDto } from './dto/place.dto';
import { BulkPlaceImportDto } from './dto/bulk-place.dto';

type OsmPlaceNode = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

const OSM_PLACE_TAGS = 'hamlet|village|locality|isolated_dwelling|neighbourhood';

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  findByMunicipality(municipalityId: string) {
    return this.prisma.place.findMany({
      where: { municipalityId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const place = await this.prisma.place.findUnique({ where: { id } });
    if (!place) throw new NotFoundException('Povoado/localidade não encontrado.');
    return place;
  }

  async create(dto: CreatePlaceDto, userId: string) {
    const place = await this.prisma.place.create({
      data: {
        name: dto.name.trim(),
        kind: dto.kind ?? PlaceKind.POVOADO,
        latitude: dto.latitude,
        longitude: dto.longitude,
        municipalityId: dto.municipalityId,
        notes: dto.notes?.trim() || null,
      },
    });
    await this.audit.log({
      userId,
      entityType: 'place',
      entityId: place.id,
      action: 'CREATE',
      afterData: auditSnapshot(place as Record<string, unknown>, ['name', 'kind', 'latitude', 'longitude']),
    });
    return place;
  }

  async update(id: string, dto: UpdatePlaceDto, userId: string) {
    const before = await this.findOne(id);
    const place = await this.prisma.place.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });
    await this.audit.log({
      userId,
      entityType: 'place',
      entityId: id,
      action: 'UPDATE',
      beforeData: auditSnapshot(before as Record<string, unknown>, ['name', 'kind', 'latitude', 'longitude']),
      afterData: auditSnapshot(place as Record<string, unknown>, ['name', 'kind', 'latitude', 'longitude']),
    });
    return place;
  }

  async remove(id: string, userId: string) {
    const before = await this.findOne(id);
    await this.prisma.place.delete({ where: { id } });
    await this.audit.log({
      userId,
      entityType: 'place',
      entityId: id,
      action: 'DELETE',
      beforeData: auditSnapshot(before as Record<string, unknown>, ['name', 'kind', 'latitude', 'longitude']),
    });
    return { ok: true };
  }

  private normalizePlaceName(name: string) {
    return name.trim().toLowerCase();
  }

  private buildPlaceNotes(ubsRef?: string, notes?: string) {
    const parts: string[] = [];
    if (ubsRef?.trim()) parts.push(`UBS de referência: ${ubsRef.trim()}`);
    if (notes?.trim()) parts.push(notes.trim());
    return parts.length > 0 ? parts.join('\n') : null;
  }

  async bulkImport(dto: BulkPlaceImportDto, userId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: dto.municipalityId },
      select: { id: true },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado.');

    const existing = await this.prisma.place.findMany({
      where: { municipalityId: dto.municipalityId },
      select: { id: true, name: true },
    });
    const byName = new Map(existing.map((row) => [this.normalizePlaceName(row.name), row]));

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; name: string; message: string }> = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const row = i + 1;
      const name = item.name?.trim();
      if (!name) {
        errors.push({ row, name: '—', message: 'Nome do povoado é obrigatório.' });
        continue;
      }

      if (
        item.latitude < -90 ||
        item.latitude > 90 ||
        item.longitude < -180 ||
        item.longitude > 180
      ) {
        errors.push({ row, name, message: 'Latitude ou longitude inválida.' });
        continue;
      }

      const notes = this.buildPlaceNotes(item.ubsRef, item.notes);
      const payload = {
        name,
        kind: item.kind ?? PlaceKind.POVOADO,
        latitude: item.latitude,
        longitude: item.longitude,
        notes,
      };

      const match = byName.get(this.normalizePlaceName(name));

      try {
        if (match) {
          const place = await this.prisma.place.update({
            where: { id: match.id },
            data: payload,
          });
          await this.audit.log({
            userId,
            entityType: 'place',
            entityId: match.id,
            action: 'UPDATE',
            afterData: auditSnapshot(place as Record<string, unknown>, [
              'name',
              'kind',
              'latitude',
              'longitude',
            ]),
          });
          updated++;
        } else {
          const place = await this.prisma.place.create({
            data: { ...payload, municipalityId: dto.municipalityId },
          });
          await this.audit.log({
            userId,
            entityType: 'place',
            entityId: place.id,
            action: 'CREATE',
            afterData: auditSnapshot(place as Record<string, unknown>, [
              'name',
              'kind',
              'latitude',
              'longitude',
            ]),
          });
          byName.set(this.normalizePlaceName(place.name), { id: place.id, name: place.name });
          created++;
        }
      } catch (error) {
        errors.push({
          row,
          name,
          message: (error as Error).message || 'Erro ao importar linha',
        });
      }
    }

    if (created === 0 && updated === 0 && errors.length === dto.items.length) {
      throw new BadRequestException({
        message: 'Nenhum povoado foi importado. Verifique o arquivo.',
        errors,
      });
    }

    return { created, updated, errors, total: dto.items.length };
  }

  async searchNominatim(municipalityId: string, query: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { name: true, state: true, latitude: true, longitude: true },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado.');

    return searchNominatim(query, {
      nominatimUrl: this.config.get<string>('NOMINATIM_URL'),
      municipalityName: municipality.name,
      state: municipality.state,
      latitude: municipality.latitude,
      longitude: municipality.longitude,
      limit: 10,
    });
  }

  async importFromOsm(municipalityId: string, userId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado.');

    const relationId = this.resolveOsmRelationId(municipality);
    const elements = await this.fetchOsmPlaces(municipality, relationId);
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const node of elements) {
      const name = this.resolvePlaceName(node.tags, node.id);
      if (!name || node.lat == null || node.lon == null) {
        skipped++;
        continue;
      }

      const kind = this.resolvePlaceKind(node.tags?.place);
      const osmNodeId = BigInt(node.id);
      const data = {
        name,
        kind,
        latitude: node.lat,
        longitude: node.lon,
        municipalityId,
        osmNodeId,
      };

      const existingByOsm = await this.prisma.place.findUnique({ where: { osmNodeId } });
      if (existingByOsm) {
        await this.prisma.place.update({
          where: { id: existingByOsm.id },
          data: {
            name: data.name,
            kind: data.kind,
            latitude: data.latitude,
            longitude: data.longitude,
          },
        });
        updated++;
        continue;
      }

      try {
        await this.prisma.place.create({ data });
        imported++;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          skipped++;
          continue;
        }
        throw error;
      }
    }

    this.logger.log(
      `Povoados OSM: ${imported} novos, ${updated} atualizados, ${skipped} ignorados`,
    );

    await this.audit.log({
      userId,
      entityType: 'place',
      entityId: municipalityId,
      action: 'IMPORT',
      afterData: { imported, updated, skipped, source: 'osm' },
    });

    return { imported, updated, skipped, total: elements.length };
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

  private async fetchOsmPlaces(
    municipality: { latitude: number; longitude: number },
    relationId: number | null,
  ): Promise<OsmPlaceNode[]> {
    const queries: string[] = [];
    if (relationId) {
      const areaId = 3_600_000_000 + relationId;
      queries.push(`
        [out:json][timeout:60];
        area(${areaId})->.municipio;
        node["place"~"${OSM_PLACE_TAGS}"](area.municipio);
        out body;
      `);
    }
    const pad = 0.12;
    const south = municipality.latitude - pad;
    const north = municipality.latitude + pad;
    const west = municipality.longitude - pad;
    const east = municipality.longitude + pad;
    queries.push(`
      [out:json][timeout:60];
      node["place"~"${OSM_PLACE_TAGS}"](${south},${west},${north},${east});
      out body;
    `);

    const overpassUrls = [
      'https://overpass.kumi.systems/api/interpreter',
      this.config.get<string>('OVERPASS_URL'),
      'https://overpass-api.de/api/interpreter',
    ].filter((url, i, arr): url is string => !!url && arr.indexOf(url) === i);

    let lastError: unknown;
    for (const query of queries) {
      for (const overpassUrl of overpassUrls) {
        try {
          const response = await fetch(overpassUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`,
            signal: AbortSignal.timeout(60_000),
          });
          if (!response.ok) continue;
          const data = (await response.json()) as { elements: OsmPlaceNode[] };
          if (data.elements.length > 0) return data.elements;
        } catch (error) {
          lastError = error;
        }
      }
    }

    if (lastError) {
      throw new BadRequestException(
        'Não foi possível buscar povoados no mapa aberto. Tente novamente em alguns minutos.',
      );
    }
    return [];
  }

  private resolvePlaceName(tags: Record<string, string> | undefined, osmId: number) {
    const name =
      tags?.name?.trim() ||
      tags?.['name:pt']?.trim() ||
      tags?.alt_name?.trim() ||
      tags?.loc_name?.trim();
    if (name) return name;
    const place = tags?.place;
    if (place) return `${place} #${osmId}`;
    return null;
  }

  private resolvePlaceKind(placeTag?: string): PlaceKind {
    if (placeTag === 'village' || placeTag === 'hamlet' || placeTag === 'isolated_dwelling') {
      return PlaceKind.POVOADO;
    }
    if (placeTag === 'locality') return PlaceKind.LOCALIDADE;
    return PlaceKind.POVOADO;
  }
}
