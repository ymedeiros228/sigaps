import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateNeighborhoodDto, UpdateNeighborhoodDto } from './dto/neighborhood.dto';

@Injectable()
export class NeighborhoodsService {
  constructor(private readonly prisma: PrismaService) {}

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

  create(dto: CreateNeighborhoodDto) {
    return this.prisma.neighborhood.create({ data: dto });
  }

  async update(id: string, dto: UpdateNeighborhoodDto) {
    await this.findOne(id);
    return this.prisma.neighborhood.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.street.updateMany({
      where: { neighborhoodId: id },
      data: { neighborhoodId: null },
    });
    return this.prisma.neighborhood.delete({ where: { id } });
  }
}
