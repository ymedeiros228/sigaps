import { Injectable, NotFoundException } from '@nestjs/common';
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

  private ubsSnapshot(ubs: { name: string; address?: string | null; phone?: string | null }) {
    return auditSnapshot(ubs as Record<string, unknown>, ['name', 'address', 'phone']);
  }

  async create(dto: CreateUbsDto, userId: string) {
    const ubs = await this.prisma.ubs.create({ data: dto });
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
    const ubs = await this.prisma.ubs.update({ where: { id }, data: dto });
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
