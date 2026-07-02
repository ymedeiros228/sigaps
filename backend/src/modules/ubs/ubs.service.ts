import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import { CreateUbsDto, UpdateUbsDto } from './dto/ubs.dto';

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
  }) {
    return auditSnapshot(ubs as Record<string, unknown>, ['name', 'address', 'phone', 'cnesCode']);
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

  async remove(id: string, userId: string) {
    const before = await this.findOne(id);
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
