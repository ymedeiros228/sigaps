import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcsDto, UpdateAcsDto } from './dto/acs.dto';

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

  create(dto: CreateAcsDto) {
    return this.prisma.acs.create({ data: dto });
  }

  async update(id: string, dto: UpdateAcsDto) {
    await this.findOne(id);
    return this.prisma.acs.update({ where: { id }, data: dto });
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
