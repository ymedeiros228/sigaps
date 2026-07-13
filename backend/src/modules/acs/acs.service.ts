import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { EntityStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { invalidateDashboardIndicators } from '../../common/utils/dashboard-cache.util';
import {
  generateInternalAcsCode,
  isInternalAcsCode,
} from '../../common/utils/internal-acs-code.util';
import { maskCpfField } from '../../common/utils/mask-cpf.util';
import { CreateAcsDto, UpdateAcsDto } from './dto/acs.dto';
import { BulkAcsImportDto } from './dto/bulk-acs.dto';
import {
  buildStreetRefCatalog,
  matchStreetRef,
  splitStreetCoverageText,
  type StreetRefCatalogEntry,
} from './acs-street-coverage.util';

type StreetCoverageCatalogEntry = StreetRefCatalogEntry;

type StreetCoverageSyncResult = {
  totalRefs: number;
  matchedRefs: number;
  paintedCount: number;
  alreadyAssignedCount: number;
  transferredCount: number;
  unmatchedRefs: string[];
  ambiguousRefs: string[];
  conflictRefs: string[];
  skippedWithoutMicroarea: boolean;
};

@Injectable()
export class AcsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findByMunicipality(municipalityId: string, viewerRole?: string) {
    return this.prisma.acs
      .findMany({
        where: { municipalityId },
        include: {
          microarea: { select: { id: true, name: true, number: true, color: true } },
        },
        orderBy: { name: 'asc' },
      })
      .then((rows) => rows.map((row) => this.maskAcsRow(row, viewerRole)));
  }

  async findOne(id: string, viewerRole?: string) {
    const acs = await this.prisma.acs.findUnique({
      where: { id },
      include: { microarea: true },
    });
    if (!acs) throw new NotFoundException('ACS nao encontrado');
    return this.maskAcsRow(acs, viewerRole);
  }

  private maskAcsRow<T extends { cpf: string }>(row: T, viewerRole?: string): T {
    if (isInternalAcsCode(row.cpf)) {
      return { ...row, cpf: '' };
    }
    return { ...row, cpf: maskCpfField(row.cpf, viewerRole) ?? row.cpf };
  }

  private async resolveCreateCpf(cpf?: string): Promise<string> {
    const normalized = cpf?.replace(/\D/g, '').trim();
    if (normalized && normalized.length === 11) {
      const existing = await this.prisma.acs.findUnique({ where: { cpf: normalized } });
      if (existing) {
        throw new ConflictException('Ja existe um ACS com este CPF.');
      }
      return normalized;
    }

    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = generateInternalAcsCode();
      const existing = await this.prisma.acs.findUnique({ where: { cpf: candidate } });
      if (!existing) return candidate;
    }

    throw new BadRequestException('Nao foi possivel gerar identificador interno do ACS.');
  }

  private acsAuditFields(acs: {
    name: string;
    cpf: string;
    phone?: string | null;
    status: string;
    photoUrl?: string | null;
    streetCoverageText?: string | null;
  }) {
    return auditSnapshot(acs as Record<string, unknown>, [
      'name',
      'cpf',
      'phone',
      'status',
      'photoUrl',
      'streetCoverageText',
    ]);
  }

  private buildStreetCoverageCatalog(
    streets: Array<{ id: string; name: string; streetType?: string | null; microareaId?: string | null }>,
  ) {
    return buildStreetRefCatalog(streets);
  }

  private matchStreetCoverageRef(ref: string, catalog: ReturnType<typeof buildStreetRefCatalog>) {
    return matchStreetRef(ref, catalog);
  }

  private formatStreetCoverageWarnings(summary: StreetCoverageSyncResult) {
    const warnings: string[] = [];
    if (summary.skippedWithoutMicroarea && summary.totalRefs > 0) {
      warnings.push('Lista de ruas recebida, mas o ACS ainda está sem microárea vinculada.');
    }
    if (summary.unmatchedRefs.length > 0) {
      warnings.push(`Ruas não encontradas: ${summary.unmatchedRefs.slice(0, 5).join(', ')}`);
    }
    if (summary.ambiguousRefs.length > 0) {
      warnings.push(`Ruas ambíguas: ${summary.ambiguousRefs.slice(0, 5).join(', ')}`);
    }
    if (summary.conflictRefs.length > 0) {
      warnings.push(
        `Ruas já pintadas em outra microárea: ${summary.conflictRefs.slice(0, 5).join(', ')}`,
      );
    }
    return warnings;
  }

  private async getCurrentMicroareaIdForAcs(acsId: string) {
    const current = await this.prisma.microarea.findFirst({
      where: { acsId },
      select: { id: true },
    });
    return current?.id ?? null;
  }

  async syncStreetCoverageForAcs(params: {
    acsId: string;
    municipalityId: string;
    userId: string;
    microareaId?: string | null;
    streetCoverageText?: string | null;
    transferFromMicroareaIds?: string[];
  }): Promise<StreetCoverageSyncResult | null> {
    const streetCoverageText =
      params.streetCoverageText !== undefined
        ? params.streetCoverageText
        : (
            await this.prisma.acs.findUnique({
              where: { id: params.acsId },
              select: { streetCoverageText: true },
            })
          )?.streetCoverageText;
    const refs = splitStreetCoverageText(streetCoverageText);
    if (refs.length === 0) return null;

    const microareaId =
      params.microareaId !== undefined
        ? params.microareaId
        : await this.getCurrentMicroareaIdForAcs(params.acsId);
    if (!microareaId) {
      return {
        totalRefs: refs.length,
        matchedRefs: 0,
        paintedCount: 0,
        alreadyAssignedCount: 0,
        transferredCount: 0,
        unmatchedRefs: [],
        ambiguousRefs: [],
        conflictRefs: [],
        skippedWithoutMicroarea: true,
      };
    }

    const streets = await this.prisma.street.findMany({
      where: { municipalityId: params.municipalityId },
      select: { id: true, name: true, streetType: true, microareaId: true },
    });
    const catalog = this.buildStreetCoverageCatalog(streets);
    const matched = new Map<string, { ref: string; street: StreetCoverageCatalogEntry }>();
    const ambiguousRefs: string[] = [];
    const unmatchedRefs: string[] = [];
    let matchedRefs = 0;

    for (const ref of refs) {
      const result = this.matchStreetCoverageRef(ref, catalog);
      if (result.status === 'matched') {
        matchedRefs++;
        if (!matched.has(result.street.id)) {
          matched.set(result.street.id, { ref, street: result.street });
        }
        continue;
      }
      if (result.status === 'ambiguous') {
        ambiguousRefs.push(ref);
        continue;
      }
      unmatchedRefs.push(ref);
    }

    const transferFromIds = new Set((params.transferFromMicroareaIds ?? []).filter(Boolean));
    const toAssign: Array<{ ref: string; street: StreetCoverageCatalogEntry }> = [];
    const conflictRefs: string[] = [];
    let alreadyAssignedCount = 0;
    let transferredCount = 0;

    for (const match of matched.values()) {
      if (!match.street.microareaId) {
        toAssign.push(match);
        continue;
      }
      if (match.street.microareaId === microareaId) {
        alreadyAssignedCount++;
        continue;
      }
      if (transferFromIds.has(match.street.microareaId)) {
        transferredCount++;
        toAssign.push(match);
        continue;
      }
      conflictRefs.push(match.ref);
    }

    const affectedMicroareas = new Set<string>([microareaId]);
    const changed = toAssign.filter((item) => item.street.microareaId !== microareaId);
    for (const item of changed) {
      if (item.street.microareaId) {
        affectedMicroareas.add(item.street.microareaId);
      }
    }

    if (changed.length > 0) {
      await this.prisma.street.updateMany({
        where: { id: { in: changed.map((item) => item.street.id) } },
        data: { microareaId },
      });
      await this.prisma.auditLog.createMany({
        data: changed.map((item) => ({
          userId: params.userId,
          entityType: 'street',
          entityId: item.street.id,
          action: 'ASSIGN_MICROAREA',
          beforeData: { microareaId: item.street.microareaId ?? null, source: 'acs-street-coverage' },
          afterData: { microareaId, source: 'acs-street-coverage', acsId: params.acsId },
        })),
      });
      for (const affectedId of affectedMicroareas) {
        try {
          await this.prisma.$executeRaw`SELECT update_microarea_envelope(${affectedId}::uuid)`;
        } catch {
          /* PostGIS opcional */
        }
      }
      invalidateDashboardIndicators(params.municipalityId);
    }

    return {
      totalRefs: refs.length,
      matchedRefs,
      paintedCount: changed.length,
      alreadyAssignedCount,
      transferredCount,
      unmatchedRefs,
      ambiguousRefs,
      conflictRefs,
      skippedWithoutMicroarea: false,
    };
  }

  private async assignToMicroarea(acsId: string, microareaId?: string | null) {
    await this.prisma.microarea.updateMany({
      where: { acsId },
      data: { acsId: null },
    });
    if (microareaId) {
      const [acs, microarea] = await Promise.all([
        this.prisma.acs.findUnique({
          where: { id: acsId },
          select: { municipalityId: true },
        }),
        this.prisma.microarea.findUnique({
          where: { id: microareaId },
          select: { municipalityId: true },
        }),
      ]);
      if (!acs) throw new NotFoundException('ACS não encontrado');
      if (!microarea) throw new NotFoundException('Microárea não encontrada');
      if (acs.municipalityId !== microarea.municipalityId) {
        throw new BadRequestException('Microárea deve pertencer ao mesmo município do ACS');
      }
      await this.prisma.microarea.update({
        where: { id: microareaId },
        data: { acsId },
      });
    }
  }

  private resolveMicroareaRef(
    ref: string | undefined,
    microareas: Array<{ id: string; name: string; number: number }>,
  ): string | undefined {
    if (!ref?.trim()) return undefined;
    const q = ref.trim().toLowerCase();
    const byNumber = microareas.find((m) => String(m.number) === q || String(m.number).padStart(2, '0') === q);
    if (byNumber) return byNumber.id;
    const byName = microareas.find((m) => m.name.toLowerCase() === q);
    if (byName) return byName.id;
    const partial = microareas.find((m) => m.name.toLowerCase().includes(q));
    return partial?.id;
  }

  private async assertMunicipality(municipalityId: string) {
    const exists = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(
        'Municipio invalido ou nao encontrado. Recarregue a pagina ou selecione o municipio no menu lateral.',
      );
    }
  }

  async create(dto: CreateAcsDto, userId: string, viewerRole?: string) {
    const { microareaId, municipalityId, cpf, ...rest } = dto;
    await this.assertMunicipality(municipalityId);
    const resolvedCpf = await this.resolveCreateCpf(cpf);
    const acs = await this.prisma.acs.create({
      data: {
        ...rest,
        cpf: resolvedCpf,
        municipalityId,
        status: rest.status ?? 'ATIVO',
        streetCoverageText: rest.streetCoverageText?.trim() || null,
      },
    });
    if (microareaId) await this.assignToMicroarea(acs.id, microareaId);
    const streetCoverageSummary = await this.syncStreetCoverageForAcs({
      acsId: acs.id,
      municipalityId,
      microareaId,
      streetCoverageText: rest.streetCoverageText,
      userId,
    });
    const result = await this.findOne(acs.id, viewerRole);

    await this.audit.log({
      userId,
      entityType: 'acs',
      entityId: acs.id,
      action: 'CREATE',
      afterData: this.acsAuditFields(acs),
    });

    return { ...result, streetCoverageSummary };
  }

  async update(id: string, dto: UpdateAcsDto, userId: string, viewerRole?: string) {
    const beforeRaw = await this.prisma.acs.findUnique({ where: { id } });
    if (!beforeRaw) throw new NotFoundException('ACS nao encontrado');
    const beforeMicroareaId = await this.getCurrentMicroareaIdForAcs(id);
    const { microareaId, municipalityId: _m, cpf: _c, ...data } = dto;
    const normalizedStreetCoverageText = dto.streetCoverageText?.trim();
    if (dto.cpf) {
      const dup = await this.prisma.acs.findFirst({
        where: { cpf: dto.cpf, NOT: { id } },
      });
      if (dup) throw new ConflictException('Ja existe outro ACS com este CPF.');
    }
    await this.prisma.acs.update({
      where: { id },
      data: {
        ...data,
        ...(dto.streetCoverageText !== undefined
          ? { streetCoverageText: normalizedStreetCoverageText || null }
          : {}),
      },
    });
    if (microareaId !== undefined) {
      await this.assignToMicroarea(id, microareaId || null);
    }
    const currentMicroareaId =
      microareaId !== undefined ? (microareaId || null) : await this.getCurrentMicroareaIdForAcs(id);
    const streetCoverageSummary = await this.syncStreetCoverageForAcs({
      acsId: id,
      municipalityId: beforeRaw.municipalityId,
      microareaId: currentMicroareaId,
      streetCoverageText:
        dto.streetCoverageText !== undefined
          ? normalizedStreetCoverageText
          : beforeRaw.streetCoverageText,
      userId,
      transferFromMicroareaIds:
        beforeMicroareaId && beforeMicroareaId !== currentMicroareaId ? [beforeMicroareaId] : [],
    });
    const afterRaw = await this.prisma.acs.findUnique({ where: { id } });
    const result = await this.findOne(id, viewerRole);

    await this.audit.log({
      userId,
      entityType: 'acs',
      entityId: id,
      action: 'UPDATE',
      beforeData: this.acsAuditFields(beforeRaw),
      afterData: afterRaw ? this.acsAuditFields(afterRaw) : undefined,
    });

    return { ...result, streetCoverageSummary };
  }

  async uploadPhoto(id: string, file: Express.Multer.File, userId: string, viewerRole?: string) {
    const before = await this.findOne(id, viewerRole);

    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    if (!allowed.includes(ext)) {
      throw new BadRequestException('Formato de imagem nao suportado. Use PNG, JPG ou WEBP.');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'acs');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${id}${ext}`;
    await writeFile(join(uploadDir, filename), file.buffer);

    const photoUrl = `/uploads/acs/${filename}`;
    const result = await this.prisma.acs.update({
      where: { id },
      data: { photoUrl },
      include: {
        microarea: { select: { id: true, name: true, number: true, color: true } },
      },
    });

    await this.audit.log({
      userId,
      entityType: 'acs',
      entityId: id,
      action: 'UPDATE',
      beforeData: { photoUrl: before.photoUrl },
      afterData: { photoUrl },
    });

    return this.maskAcsRow(result, viewerRole);
  }

  async bulkImport(dto: BulkAcsImportDto, userId: string, viewerRole?: string) {
    const microareas = await this.prisma.microarea.findMany({
      where: { municipalityId: dto.municipalityId },
      select: { id: true, name: true, number: true },
    });

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; ref: string; message: string }> = [];
    const streetAutomation = {
      painted: 0,
      unmatched: 0,
      ambiguous: 0,
      conflicts: 0,
      skippedWithoutMicroarea: 0,
    };

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const row = i + 1;
      const ref = maskCpfField(item.cpf, viewerRole) ?? item.name;
      try {
        const microareaId = this.resolveMicroareaRef(item.microareaRef, microareas);
        if (item.microareaRef && !microareaId) {
          errors.push({
            row,
            ref,
            message: `Microarea "${item.microareaRef}" nao encontrada`,
          });
          continue;
        }

        const normalizedCpf = item.cpf?.replace(/\D/g, '').trim() || undefined;
        let existing = normalizedCpf
          ? await this.prisma.acs.findUnique({ where: { cpf: normalizedCpf } })
          : null;

        if (!existing) {
          existing = await this.prisma.acs.findFirst({
            where: {
              municipalityId: dto.municipalityId,
              name: { equals: item.name.trim(), mode: 'insensitive' as const },
            },
          });
        }

        if (existing) {
          const previousMicroareaId = await this.getCurrentMicroareaIdForAcs(existing.id);
          const data: {
            name: string;
            phone?: string;
            status: EntityStatus;
            cpf?: string;
            streetCoverageText?: string;
          } = {
            name: item.name,
            phone: item.phone,
            status: item.status ?? existing.status,
            streetCoverageText:
              item.streetCoverageText?.trim() || existing.streetCoverageText || undefined,
          };

          if (
            normalizedCpf &&
            existing.cpf !== normalizedCpf &&
            isInternalAcsCode(existing.cpf)
          ) {
            const duplicateCpf = await this.prisma.acs.findFirst({
              where: { cpf: normalizedCpf, NOT: { id: existing.id } },
              select: { id: true },
            });
            if (!duplicateCpf) {
              data.cpf = normalizedCpf;
            }
          }

          await this.prisma.acs.update({
            where: { id: existing.id },
            data,
          });
          if (microareaId) await this.assignToMicroarea(existing.id, microareaId);
          const streetCoverageSummary = await this.syncStreetCoverageForAcs({
            acsId: existing.id,
            municipalityId: dto.municipalityId,
            microareaId,
            streetCoverageText: data.streetCoverageText,
            userId,
            transferFromMicroareaIds:
              previousMicroareaId && previousMicroareaId !== microareaId
                ? [previousMicroareaId]
                : [],
          });
          if (streetCoverageSummary) {
            streetAutomation.painted += streetCoverageSummary.paintedCount;
            streetAutomation.unmatched += streetCoverageSummary.unmatchedRefs.length;
            streetAutomation.ambiguous += streetCoverageSummary.ambiguousRefs.length;
            streetAutomation.conflicts += streetCoverageSummary.conflictRefs.length;
            if (streetCoverageSummary.skippedWithoutMicroarea) {
              streetAutomation.skippedWithoutMicroarea += 1;
            }
            for (const warning of this.formatStreetCoverageWarnings(streetCoverageSummary)) {
              errors.push({ row, ref, message: warning });
            }
          }
          await this.audit.log({
            userId,
            entityType: 'acs',
            entityId: existing.id,
            action: 'UPDATE',
            afterData: auditSnapshot({
              name: item.name,
              cpf: data.cpf ?? existing.cpf,
              phone: item.phone,
              status: item.status ?? existing.status,
              streetCoverageText: data.streetCoverageText ?? existing.streetCoverageText,
            }),
          });
          updated++;
        } else {
          const resolvedCpf = await this.resolveCreateCpf(normalizedCpf);
          const acs = await this.prisma.acs.create({
            data: {
              name: item.name,
              cpf: resolvedCpf,
              phone: item.phone,
              status: item.status ?? 'ATIVO',
              municipalityId: dto.municipalityId,
              streetCoverageText: item.streetCoverageText?.trim() || null,
            },
          });
          if (microareaId) await this.assignToMicroarea(acs.id, microareaId);
          const streetCoverageSummary = await this.syncStreetCoverageForAcs({
            acsId: acs.id,
            municipalityId: dto.municipalityId,
            microareaId,
            streetCoverageText: item.streetCoverageText,
            userId,
          });
          if (streetCoverageSummary) {
            streetAutomation.painted += streetCoverageSummary.paintedCount;
            streetAutomation.unmatched += streetCoverageSummary.unmatchedRefs.length;
            streetAutomation.ambiguous += streetCoverageSummary.ambiguousRefs.length;
            streetAutomation.conflicts += streetCoverageSummary.conflictRefs.length;
            if (streetCoverageSummary.skippedWithoutMicroarea) {
              streetAutomation.skippedWithoutMicroarea += 1;
            }
            for (const warning of this.formatStreetCoverageWarnings(streetCoverageSummary)) {
              errors.push({ row, ref, message: warning });
            }
          }
          await this.audit.log({
            userId,
            entityType: 'acs',
            entityId: acs.id,
            action: 'CREATE',
            afterData: auditSnapshot({
              name: item.name,
              cpf: resolvedCpf,
              phone: item.phone,
              status: item.status ?? 'ATIVO',
              streetCoverageText: item.streetCoverageText?.trim() || null,
            }),
          });
          created++;
        }
      } catch (error) {
        errors.push({
          row,
          ref,
          message: (error as Error).message || 'Erro ao importar linha',
        });
      }
    }

    if (created === 0 && updated === 0 && errors.length === dto.items.length) {
      throw new BadRequestException({
        message: 'Nenhum ACS foi importado. Verifique o arquivo.',
        errors,
      });
    }

    return { created, updated, errors, total: dto.items.length, streetAutomation };
  }

  async remove(id: string, userId: string) {
    const beforeRaw = await this.prisma.acs.findUnique({ where: { id } });
    if (!beforeRaw) throw new NotFoundException('ACS nao encontrado');
    await this.prisma.microarea.updateMany({
      where: { acsId: id },
      data: { acsId: null },
    });
    await this.prisma.acs.delete({ where: { id } });

    await this.audit.log({
      userId,
      entityType: 'acs',
      entityId: id,
      action: 'DELETE',
      beforeData: this.acsAuditFields(beforeRaw),
    });

    return { ok: true };
  }
}
