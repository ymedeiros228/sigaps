import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { CreateUbsDto, UpdateUbsDto } from './dto/ubs.dto';
import { BulkUbsImportDto } from './dto/bulk-ubs.dto';

@Injectable()
export class UbsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findByMunicipality(municipalityId: string) {
    return this.prisma.ubs.findMany({
      where: { municipalityId },
      include: { _count: { select: { microareas: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const ubs = await this.prisma.ubs.findUnique({
      where: { id },
      include: { microareas: { select: { id: true, name: true, number: true } } },
    });
    if (!ubs) throw new NotFoundException('UBS não encontrada');
    return ubs;
  }

  private ubsSnapshot(ubs: {
    name: string;
    address?: string | null;
    phone?: string | null;
    cnesCode?: string | null;
    latitude?: number;
    longitude?: number;
  }) {
    return auditSnapshot(ubs as Record<string, unknown>, [
      'name',
      'address',
      'phone',
      'cnesCode',
      'latitude',
      'longitude',
    ]);
  }

  private normalizeName(name: string) {
    return name.trim().toLowerCase();
  }

  private normalizeCnes(value?: string | null) {
    if (!value) return undefined;
    const digits = String(value).replace(/\D/g, '');
    return digits.length === 7 ? digits : undefined;
  }

  private prepareUbsData(dto: CreateUbsDto): Prisma.UbsUncheckedCreateInput;
  private prepareUbsData(dto: UpdateUbsDto, isUpdate: true): Prisma.UbsUncheckedUpdateInput;
  private prepareUbsData(
    dto: CreateUbsDto | UpdateUbsDto,
    isUpdate = false,
  ): Prisma.UbsUncheckedCreateInput | Prisma.UbsUncheckedUpdateInput {
    const data = { ...dto } as Record<string, unknown>;
    if ('cnesCode' in dto && !dto.cnesCode) {
      if (isUpdate) data.cnesCode = null;
      else delete data.cnesCode;
    }
    return data as Prisma.UbsUncheckedCreateInput | Prisma.UbsUncheckedUpdateInput;
  }

  private async assertMunicipality(municipalityId: string) {
    const exists = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException(
        'Município inválido ou não encontrado. Recarregue a página ou selecione o município no menu lateral.',
      );
    }
  }

  async create(dto: CreateUbsDto, userId: string) {
    await this.assertMunicipality(dto.municipalityId);
    const ubs = await this.prisma.ubs.create({ data: this.prepareUbsData(dto) });
    await this.audit.log({
      userId,
      entityType: 'ubs',
      entityId: ubs.id,
      action: 'CREATE',
      afterData: this.ubsSnapshot(ubs),
    });
    return ubs;
  }

  async update(id: string, dto: UpdateUbsDto, userId: string) {
    const before = await this.findOne(id);
    const ubs = await this.prisma.ubs.update({ where: { id }, data: this.prepareUbsData(dto, true) });
    await this.audit.log({
      userId,
      entityType: 'ubs',
      entityId: id,
      action: 'UPDATE',
      beforeData: this.ubsSnapshot(before),
      afterData: this.ubsSnapshot(ubs),
    });
    return ubs;
  }

  async bulkImport(dto: BulkUbsImportDto, userId: string) {
    await this.assertMunicipality(dto.municipalityId);

    const existing = await this.prisma.ubs.findMany({
      where: { municipalityId: dto.municipalityId },
      select: { id: true, name: true, cnesCode: true },
    });

    const byCnes = new Map(
      existing.filter((row) => row.cnesCode).map((row) => [row.cnesCode as string, row]),
    );
    const byName = new Map(existing.map((row) => [this.normalizeName(row.name), row]));

    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; name: string; message: string }> = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      const row = i + 1;
      const name = item.name?.trim();
      if (!name) {
        errors.push({ row, name: '—', message: 'Nome da UBS é obrigatório.' });
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

      const cnesCode = this.normalizeCnes(item.cnesCode);
      const match =
        (cnesCode ? byCnes.get(cnesCode) : undefined) ??
        byName.get(this.normalizeName(name));

      const payload = {
        name,
        address: item.address?.trim() || 'Endereço não informado',
        phone: item.phone?.trim() || null,
        coordinator: item.coordinator?.trim() || null,
        cnesCode: cnesCode ?? null,
        latitude: item.latitude,
        longitude: item.longitude,
      };

      try {
        if (match) {
          const ubs = await this.prisma.ubs.update({
            where: { id: match.id },
            data: payload,
          });
          await this.audit.log({
            userId,
            entityType: 'ubs',
            entityId: match.id,
            action: 'UPDATE',
            afterData: this.ubsSnapshot(ubs),
          });
          byName.set(this.normalizeName(ubs.name), { id: ubs.id, name: ubs.name, cnesCode: ubs.cnesCode });
          if (ubs.cnesCode) byCnes.set(ubs.cnesCode, { id: ubs.id, name: ubs.name, cnesCode: ubs.cnesCode });
          updated++;
        } else {
          const ubs = await this.prisma.ubs.create({
            data: { ...payload, municipalityId: dto.municipalityId },
          });
          await this.audit.log({
            userId,
            entityType: 'ubs',
            entityId: ubs.id,
            action: 'CREATE',
            afterData: this.ubsSnapshot(ubs),
          });
          byName.set(this.normalizeName(ubs.name), { id: ubs.id, name: ubs.name, cnesCode: ubs.cnesCode });
          if (ubs.cnesCode) byCnes.set(ubs.cnesCode, { id: ubs.id, name: ubs.name, cnesCode: ubs.cnesCode });
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
        message: 'Nenhuma UBS foi importada. Verifique o arquivo.',
        errors,
      });
    }

    return { created, updated, errors, total: dto.items.length };
  }

  async remove(id: string, userId: string) {
    const before = await this.findOne(id);
    await this.prisma.microarea.updateMany({
      where: { ubsId: id },
      data: { ubsId: null },
    });
    await this.prisma.ubs.delete({ where: { id } });
    await this.audit.log({
      userId,
      entityType: 'ubs',
      entityId: id,
      action: 'DELETE',
      beforeData: this.ubsSnapshot(before),
    });
    return { ok: true };
  }
}
