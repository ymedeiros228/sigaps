import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toText } from '../../common/utils/to-text.util';

const BACKUP_VERSION = 1;
const AUTO_BACKUP_RETENTION = 4;

type StreetRow = {
  id: string;
  osmId: bigint | null;
  name: string;
  streetType: string | null;
  neighborhoodId: string | null;
  microareaId: string | null;
  municipalityId: string;
  lengthMeters: number | null;
  propertyCount: number;
  familyCount: number;
  inhabitantCount: number;
  notes: string | null;
  geojson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class BackupService {
  constructor(private readonly prisma: PrismaService) {}

  async exportBackup(municipalityId: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado');

    const [
      neighborhoods,
      ubs,
      acs,
      microareas,
      streets,
      paintZones,
      users,
      auditLogs,
    ] = await Promise.all([
      this.prisma.neighborhood.findMany({ where: { municipalityId } }),
      this.prisma.ubs.findMany({ where: { municipalityId } }),
      this.prisma.acs.findMany({ where: { municipalityId } }),
      this.prisma.microarea.findMany({ where: { municipalityId } }),
      this.prisma.street.findMany({ where: { municipalityId } }),
      this.prisma.microareaPaintZone.findMany({ where: { municipalityId } }),
      this.prisma.user.findMany({
        where: { municipalityId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: { user: { municipalityId } },
        orderBy: { createdAt: 'desc' },
        take: 1000,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    return {
      format: 'sigaps-backup',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      municipalityId,
      municipality: {
        id: municipality.id,
        name: municipality.name,
        state: municipality.state,
        prefecture: municipality.prefecture,
        secretariat: municipality.secretariat,
        logoUrl: municipality.logoUrl,
        latitude: municipality.latitude,
        longitude: municipality.longitude,
        osmRelationId: municipality.osmRelationId,
      },
      counts: {
        neighborhoods: neighborhoods.length,
        ubs: ubs.length,
        acs: acs.length,
        microareas: microareas.length,
        streets: streets.length,
        paintZones: paintZones.length,
        users: users.length,
        auditLogs: auditLogs.length,
      },
      data: {
        neighborhoods,
        ubs,
        acs,
        microareas,
        streets: streets.map((s) => this.serializeStreet(s)),
        paintZones,
        users,
        auditLogs: auditLogs.map((log) => ({
          id: log.id,
          userId: log.userId,
          entityType: log.entityType,
          entityId: log.entityId,
          action: log.action,
          beforeData: log.beforeData,
          afterData: log.afterData,
          createdAt: log.createdAt,
          user: log.user,
        })),
      },
    };
  }

  async importBackup(municipalityId: string, payload: Record<string, unknown>) {
    if (payload.format !== 'sigaps-backup') {
      throw new BadRequestException(
        'Arquivo inválido: não é um backup SIGAPS.',
      );
    }
    if (payload.municipalityId !== municipalityId) {
      throw new BadRequestException('Este backup pertence a outro município.');
    }
    const version = Number(payload.version ?? 0);
    if (version !== BACKUP_VERSION) {
      throw new BadRequestException(
        `Versão de backup não suportada: ${version}`,
      );
    }

    const data = payload.data as Record<string, unknown[]> | undefined;
    if (!data) throw new BadRequestException('Backup sem dados.');

    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });
    if (!municipality) throw new NotFoundException('Município não encontrado');

    const stats = {
      neighborhoods: 0,
      ubs: 0,
      acs: 0,
      microareas: 0,
      streets: 0,
      paintZones: 0,
    };

    await this.prisma.$transaction(async (tx) => {
      for (const row of (data.neighborhoods ?? []) as Array<
        Record<string, unknown>
      >) {
        await tx.neighborhood.upsert({
          where: { id: row.id as string },
          create: {
            id: row.id as string,
            name: row.name as string,
            municipalityId,
          },
          update: {
            name: row.name as string,
          },
        });
        stats.neighborhoods++;
      }

      for (const row of (data.ubs ?? []) as Array<Record<string, unknown>>) {
        await tx.ubs.upsert({
          where: { id: row.id as string },
          create: {
            id: row.id as string,
            name: row.name as string,
            address: row.address as string,
            phone: (row.phone as string) ?? null,
            coordinator: (row.coordinator as string) ?? null,
            latitude: row.latitude as number,
            longitude: row.longitude as number,
            municipalityId,
          },
          update: {
            name: row.name as string,
            address: row.address as string,
            phone: (row.phone as string) ?? null,
            coordinator: (row.coordinator as string) ?? null,
            latitude: row.latitude as number,
            longitude: row.longitude as number,
          },
        });
        stats.ubs++;
      }

      for (const row of (data.acs ?? []) as Array<Record<string, unknown>>) {
        await tx.acs.upsert({
          where: { id: row.id as string },
          create: {
            id: row.id as string,
            name: row.name as string,
            cpf: row.cpf as string,
            phone: (row.phone as string) ?? null,
            photoUrl: (row.photoUrl as string) ?? null,
            status: row.status as 'ATIVO' | 'INATIVO',
            municipalityId,
          },
          update: {
            name: row.name as string,
            phone: (row.phone as string) ?? null,
            photoUrl: (row.photoUrl as string) ?? null,
            status: row.status as 'ATIVO' | 'INATIVO',
          },
        });
        stats.acs++;
      }

      await tx.microarea.updateMany({
        where: { municipalityId },
        data: { acsId: null },
      });

      for (const row of (data.microareas ?? []) as Array<
        Record<string, unknown>
      >) {
        await tx.microarea.upsert({
          where: { id: row.id as string },
          create: {
            id: row.id as string,
            number: row.number as number,
            name: row.name as string,
            color: row.color as string,
            description: (row.description as string) ?? null,
            status: (row.status as 'ATIVO' | 'INATIVO') ?? 'ATIVO',
            ubsId: (row.ubsId as string) ?? null,
            acsId: (row.acsId as string) ?? null,
            neighborhoodId: (row.neighborhoodId as string) ?? null,
            municipalityId,
          },
          update: {
            number: row.number as number,
            name: row.name as string,
            color: row.color as string,
            description: (row.description as string) ?? null,
            status: (row.status as 'ATIVO' | 'INATIVO') ?? 'ATIVO',
            ubsId: (row.ubsId as string) ?? null,
            acsId: (row.acsId as string) ?? null,
            neighborhoodId: (row.neighborhoodId as string) ?? null,
          },
        });
        stats.microareas++;
      }

      for (const row of (data.streets ?? []) as Array<
        Record<string, unknown>
      >) {
        const osmRaw = row.osmId;
        const osmId =
          osmRaw === null || osmRaw === undefined
            ? null
            : BigInt(toText(osmRaw));

        await tx.street.upsert({
          where: { id: row.id as string },
          create: {
            id: row.id as string,
            osmId,
            name: row.name as string,
            streetType: (row.streetType as string) ?? null,
            neighborhoodId: (row.neighborhoodId as string) ?? null,
            microareaId: (row.microareaId as string) ?? null,
            municipalityId,
            lengthMeters: (row.lengthMeters as number) ?? null,
            propertyCount: (row.propertyCount as number) ?? 0,
            familyCount: (row.familyCount as number) ?? 0,
            inhabitantCount: (row.inhabitantCount as number) ?? 0,
            notes: (row.notes as string) ?? null,
            geojson: row.geojson as Prisma.InputJsonValue,
          },
          update: {
            name: row.name as string,
            streetType: (row.streetType as string) ?? null,
            neighborhoodId: (row.neighborhoodId as string) ?? null,
            microareaId: (row.microareaId as string) ?? null,
            lengthMeters: (row.lengthMeters as number) ?? null,
            propertyCount: (row.propertyCount as number) ?? 0,
            familyCount: (row.familyCount as number) ?? 0,
            inhabitantCount: (row.inhabitantCount as number) ?? 0,
            notes: (row.notes as string) ?? null,
            geojson: row.geojson as Prisma.InputJsonValue,
          },
        });
        stats.streets++;
      }

      for (const row of (data.paintZones ?? []) as Array<
        Record<string, unknown>
      >) {
        await tx.microareaPaintZone.upsert({
          where: { id: row.id as string },
          create: {
            id: row.id as string,
            name: (row.name as string) ?? null,
            microareaId: row.microareaId as string,
            municipalityId,
            centerLat: row.centerLat as number,
            centerLng: row.centerLng as number,
            radiusMeters: row.radiusMeters as number,
            geojson: row.geojson as Prisma.InputJsonValue,
          },
          update: {
            name: (row.name as string) ?? null,
            microareaId: row.microareaId as string,
            centerLat: row.centerLat as number,
            centerLng: row.centerLng as number,
            radiusMeters: row.radiusMeters as number,
            geojson: row.geojson as Prisma.InputJsonValue,
          },
        });
        stats.paintZones++;
      }
    });

    return { ok: true, restored: stats };
  }

  async saveAutoBackup(municipalityId: string) {
    const payload = await this.exportBackup(municipalityId);
    const dir = this.autoBackupDir(municipalityId);
    await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `auto-${stamp}.json`;
    const filepath = join(dir, filename);
    await writeFile(filepath, JSON.stringify(payload), 'utf8');

    await this.pruneAutoBackups(municipalityId);

    const info = await stat(filepath);
    return {
      filename,
      sizeBytes: info.size,
      createdAt: info.mtime.toISOString(),
    };
  }

  async listAutoBackups(municipalityId: string) {
    const dir = this.autoBackupDir(municipalityId);
    try {
      const files = await readdir(dir);
      const items = await Promise.all(
        files
          .filter((f) => f.startsWith('auto-') && f.endsWith('.json'))
          .map(async (filename) => {
            const info = await stat(join(dir, filename));
            return {
              filename,
              sizeBytes: info.size,
              createdAt: info.mtime.toISOString(),
            };
          }),
      );
      const sorted = items.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      return {
        lastAutoBackupAt: sorted[0]?.createdAt ?? null,
        items: sorted,
        retentionNote:
          'Backups automáticos ficam no disco do servidor (efêmero no Render free). Baixe periodicamente.',
      };
    } catch {
      return {
        lastAutoBackupAt: null,
        items: [] as Array<{
          filename: string;
          sizeBytes: number;
          createdAt: string;
        }>,
        retentionNote:
          'Backups automáticos ficam no disco do servidor (efêmero no Render free). Baixe periodicamente.',
      };
    }
  }

  async readAutoBackup(municipalityId: string, filename: string) {
    if (!/^auto-[\dTZ-]+\.json$/.test(filename)) {
      throw new BadRequestException('Nome de arquivo inválido.');
    }
    const filepath = join(this.autoBackupDir(municipalityId), filename);
    try {
      const raw = await readFile(filepath, 'utf8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new NotFoundException('Backup automático não encontrado.');
    }
  }

  private autoBackupDir(municipalityId: string) {
    return join(process.cwd(), 'uploads', 'backups', municipalityId);
  }

  private async pruneAutoBackups(municipalityId: string) {
    const retention = Number(
      process.env.AUTO_BACKUP_RETENTION ?? AUTO_BACKUP_RETENTION,
    );
    const maxKeep =
      Number.isFinite(retention) && retention > 0
        ? retention
        : AUTO_BACKUP_RETENTION;
    const listing = await this.listAutoBackups(municipalityId);
    const excess = listing.items.slice(maxKeep);
    await Promise.all(
      excess.map((item) =>
        unlink(join(this.autoBackupDir(municipalityId), item.filename)).catch(
          () => {},
        ),
      ),
    );
  }

  private serializeStreet(s: StreetRow) {
    return {
      ...s,
      osmId: s.osmId?.toString() ?? null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }
}
