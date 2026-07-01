import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMunicipalityDto } from './dto/municipality.dto';

@Injectable()
export class MunicipalitiesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.municipality.findMany({ orderBy: { name: 'asc' } });
  }

  findOne(id: string) {
    return this.prisma.municipality.findUniqueOrThrow({ where: { id } });
  }

  create(dto: CreateMunicipalityDto) {
    return this.prisma.municipality.create({ data: dto });
  }
}
