import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { auditSnapshot } from '../../common/utils/audit-snapshot.util';
import {
  CreateNeighborhoodDto,
  UpdateNeighborhoodDto,
} from './dto/neighborhood.dto';

@Injectable()
export class NeighborhoodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findByMunicipality(municipalityId: string) {
    return this.prisma.neighborhood.findMany({
      where: { municipalityId },
      include: { _count: { select: { streets: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const neighborhood = await this.prisma.neighborhood.findUnique({
      where: { id },
      include: { _count: { select: { streets: true } } },
    });
    if (!neighborhood) throw new NotFoundException('Bairro não encontrado');
    return neighborhood;
  }

  async create(dto: CreateNeighborhoodDto, userId: string) {
    const neighborhood = await this.prisma.neighborhood.create({ data: dto });
    await this.audit.log({
      userId,
      entityType: 'neighborhood',
      entityId: neighborhood.id,
      action: 'CREATE',
      afterData: auditSnapshot(neighborhood as Record<string, unknown>, [
        'name',
      ]),
    });
    return neighborhood;
  }

  async update(id: string, dto: UpdateNeighborhoodDto, userId: string) {
    const before = await this.findOne(id);
    const neighborhood = await this.prisma.neighborhood.update({
      where: { id },
      data: dto,
    });
    await this.audit.log({
      userId,
      entityType: 'neighborhood',
      entityId: id,
      action: 'UPDATE',
      beforeData: auditSnapshot(before as Record<string, unknown>, ['name']),
      afterData: auditSnapshot(neighborhood as Record<string, unknown>, [
        'name',
      ]),
    });
    return neighborhood;
  }

  async remove(id: string, userId: string) {
    const before = await this.findOne(id);
    await this.prisma.street.updateMany({
      where: { neighborhoodId: id },
      data: { neighborhoodId: null },
    });
    await this.prisma.microarea.updateMany({
      where: { neighborhoodId: id },
      data: { neighborhoodId: null },
    });
    await this.prisma.neighborhood.delete({ where: { id } });
    await this.audit.log({
      userId,
      entityType: 'neighborhood',
      entityId: id,
      action: 'DELETE',
      beforeData: auditSnapshot(before as Record<string, unknown>, ['name']),
    });
    return { ok: true };
  }
}
