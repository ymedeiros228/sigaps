import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUbsDto, UpdateUbsDto } from './dto/ubs.dto';

@Injectable()
export class UbsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(dto: CreateUbsDto) {
    return this.prisma.ubs.create({ data: dto });
  }

  async update(id: string, dto: UpdateUbsDto) {
    await this.findOne(id);
    return this.prisma.ubs.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.ubs.delete({ where: { id } });
  }
}
