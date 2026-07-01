import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMunicipalityDto } from './dto/municipality.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';

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

  async update(id: string, dto: UpdateMunicipalityDto) {
    await this.findOne(id);
    return this.prisma.municipality.update({ where: { id }, data: dto });
  }

  async uploadLogo(id: string, file: Express.Multer.File) {
    await this.findOne(id);

    const allowed = ['.png', '.jpg', '.jpeg', '.webp', '.svg'];
    const ext = extname(file.originalname).toLowerCase() || '.png';
    if (!allowed.includes(ext)) {
      throw new Error('Formato de imagem não suportado. Use PNG, JPG, WEBP ou SVG.');
    }

    const uploadDir = join(process.cwd(), 'uploads', 'logos');
    await mkdir(uploadDir, { recursive: true });

    const filename = `${id}${ext}`;
    await writeFile(join(uploadDir, filename), file.buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    return this.prisma.municipality.update({
      where: { id },
      data: { logoUrl },
    });
  }
}
