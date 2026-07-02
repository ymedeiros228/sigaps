import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { maskCpfField } from '../../common/utils/mask-cpf.util';
import { CreateAcsDto, UpdateAcsDto } from './dto/acs.dto';
import { BulkAcsImportDto } from './dto/bulk-acs.dto';

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
    if (!acs) throw new NotFoundException('ACS não encontrado');
    return this.maskAcsRow(acs, viewerRole);
  }

  private maskAcsRow<T extends { cpf: string }>(row: T, viewerRole?: string): T {
    return { ...row, cpf: maskCpfField(row.cpf, viewerRole) ?? row.cpf };
  }

  private acsAuditFields(acs: {
    name: string;
    cpf: string;
    phone?: string | null;
    status: string;
    photoUrl?: string | null;
  }) {
    return auditSnapshot(acs as Record<string, unknown>, [
      'name',
      'cpf',
      'phone',
      'status',
      'photoUrl',
    ]);
  }

  private async assignToMicroarea(acsId: string, microareaId?: string | null) {
    await this.prisma.microarea.updateMany({
      where: { acsId },
      data: { acsId: null },
    });
    if (microareaId) {
      const microarea = await this.prisma.microarea.findUnique({
        where: { id: microareaId },
      });
      if (!microarea) throw new NotFoundException('Microárea não encontrada');
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

  async create(dto: CreateAcsDto, userId: string, viewerRole?: string) {
    const { microareaId, ...data } = dto;
    const existing = await this.prisma.acs.findUnique({ where: { cpf: data.cpf } });
    if (existing) {
      throw new ConflictException('Já existe um ACS com este CPF.');
    }
    const acs = await this.prisma.acs.create({ data });
    if (microareaId) await this.assignToMicroarea(acs.id, microareaId);
    const result = await this.findOne(acs.id, viewerRole);

    await this.audit.log({
      userId,
      entityType: 'acs',
      entityId: acs.id,
      action: 'CREATE',
      afterData: this.acsAuditFields(acs),
    });

    return result;
  }

  async update(id: string, dto: UpdateAcsDto, userId: string, viewerRole?: string) {
    const beforeRaw = await this.prisma.acs.findUnique({ where: { id } });
    if (!beforeRaw) throw new NotFoundException('ACS não encontrado');
    const { microareaId, municipalityId: _m, cpf: _c, ...data } = dto;
    if (dto.cpf) {
      const dup = await this.prisma.acs.findFirst({
        where: { cpf: dto.cpf, NOT: { id } },
      });
      if (dup) throw new ConflictException('Já existe outro ACS com este CPF.');
    }
    await this.prisma.acs.update({ where: { id }, data });
    if (microareaId !== undefined) {
      await this.assignToMicroarea(id, microareaId || null);
    }
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

    return result;
  }

  async uploadPhoto(id: string, file: Express.Multer.File, userId: string, viewerRole?: string) {
    const before = await this.findOne(id, viewerRole);

    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    if (!allowed.includes(ext)) {
      throw new BadRequestException('Formato de imagem não suportado. Use PNG, JPG ou WEBP.');
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
    const errors: Array<{ row: number; cpf: string; message: string }> = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const row = i + 1;
      try {
        const microareaId = this.resolveMicroareaRef(item.microareaRef, microareas);
        if (item.microareaRef && !microareaId) {
          errors.push({
            row,
            cpf: maskCpfField(item.cpf, viewerRole) ?? item.cpf,
            message: `Microárea "${item.microareaRef}" não encontrada`,
          });
          continue;
        }

        const existing = await this.prisma.acs.findUnique({ where: { cpf: item.cpf } });
        if (existing) {
          await this.prisma.acs.update({
            where: { id: existing.id },
            data: {
              name: item.name,
              phone: item.phone,
              status: item.status ?? existing.status,
            },
          });
          if (microareaId) await this.assignToMicroarea(existing.id, microareaId);
          await this.audit.log({
            userId,
            entityType: 'acs',
            entityId: existing.id,
            action: 'UPDATE',
            afterData: auditSnapshot({
              name: item.name,
              cpf: item.cpf,
              phone: item.phone,
              status: item.status ?? existing.status,
            }),
          });
          updated++;
        } else {
          const acs = await this.prisma.acs.create({
            data: {
              name: item.name,
              cpf: item.cpf,
              phone: item.phone,
              status: item.status ?? 'ATIVO',
              municipalityId: dto.municipalityId,
            },
          });
          if (microareaId) await this.assignToMicroarea(acs.id, microareaId);
          await this.audit.log({
            userId,
            entityType: 'acs',
            entityId: acs.id,
            action: 'CREATE',
            afterData: auditSnapshot({
              name: item.name,
              cpf: item.cpf,
              phone: item.phone,
              status: item.status ?? 'ATIVO',
            }),
          });
          created++;
        }
      } catch (error) {
        errors.push({
          row,
          cpf: maskCpfField(item.cpf, viewerRole) ?? item.cpf,
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

    return { created, updated, errors, total: dto.items.length };
  }

  async remove(id: string, userId: string) {
    const beforeRaw = await this.prisma.acs.findUnique({ where: { id } });
    if (!beforeRaw) throw new NotFoundException('ACS não encontrado');
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
