import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcsDto, UpdateAcsDto } from './dto/acs.dto';
import { BulkAcsImportDto } from './dto/bulk-acs.dto';

@Injectable()
export class AcsService {
  constructor(private readonly prisma: PrismaService) {}

  findByMunicipality(municipalityId: string) {
    return this.prisma.acs.findMany({
      where: { municipalityId },
      include: {
        microarea: { select: { id: true, name: true, number: true, color: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const acs = await this.prisma.acs.findUnique({
      where: { id },
      include: { microarea: true },
    });
    if (!acs) throw new NotFoundException('ACS não encontrado');
    return acs;
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

  async create(dto: CreateAcsDto) {
    const { microareaId, ...data } = dto;
    const existing = await this.prisma.acs.findUnique({ where: { cpf: data.cpf } });
    if (existing) {
      throw new ConflictException('Já existe um ACS com este CPF.');
    }
    const acs = await this.prisma.acs.create({ data });
    if (microareaId) await this.assignToMicroarea(acs.id, microareaId);
    return this.findOne(acs.id);
  }

  async update(id: string, dto: UpdateAcsDto) {
    await this.findOne(id);
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
    return this.findOne(id);
  }

  async bulkImport(dto: BulkAcsImportDto) {
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
            cpf: item.cpf,
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
          created++;
        }
      } catch (error) {
        errors.push({
          row,
          cpf: item.cpf,
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

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.microarea.updateMany({
      where: { acsId: id },
      data: { acsId: null },
    });
    return this.prisma.acs.delete({ where: { id } });
  }
}
