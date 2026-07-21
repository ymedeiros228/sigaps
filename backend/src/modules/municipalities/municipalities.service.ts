import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityStatus } from '@prisma/client';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { invalidateDashboardIndicators } from '../../common/utils/dashboard-cache.util';
import { CreateMunicipalityDto } from './dto/municipality.dto';
import { MapHomologationDto } from './dto/map-homologation.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';

@Injectable()
export class MunicipalitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.municipality.findMany({ orderBy: { name: 'asc' } });
  }

  async getCadastrosSummary(id: string) {
    await this.findOne(id);
    const [ubs, acs, neighborhoods, microareas, acsSemMicro, acsAtivos] =
      await this.prisma.$transaction([
        this.prisma.ubs.count({ where: { municipalityId: id } }),
        this.prisma.acs.count({ where: { municipalityId: id } }),
        this.prisma.neighborhood.count({ where: { municipalityId: id } }),
        this.prisma.microarea.count({ where: { municipalityId: id } }),
        this.prisma.acs.count({
          where: { municipalityId: id, microarea: null },
        }),
        this.prisma.acs.count({
          where: { municipalityId: id, status: EntityStatus.ATIVO },
        }),
      ]);
    return { ubs, acs, neighborhoods, microareas, acsSemMicro, acsAtivos };
  }

  async findOne(id: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        state: true,
        prefecture: true,
        secretariat: true,
        logoUrl: true,
        latitude: true,
        longitude: true,
        osmRelationId: true,
        mapHomologatedAt: true,
        mapHomologatedBy: true,
        mapHomologationNotes: true,
        esusLastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!municipality) {
      throw new NotFoundException('Município não encontrado');
    }
    return municipality;
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
      throw new Error(
        'Formato de imagem não suportado. Use PNG, JPG, WEBP ou SVG.',
      );
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

  async setMapHomologation(
    id: string,
    dto: MapHomologationDto,
    user: { id: string; name: string },
  ) {
    const before = await this.findOne(id);
    const data = dto.homologated
      ? {
          mapHomologatedAt: new Date(),
          mapHomologatedBy: user.name,
          mapHomologationNotes: dto.notes?.trim() || null,
        }
      : {
          mapHomologatedAt: null,
          mapHomologatedBy: null,
          mapHomologationNotes: null,
        };

    const updated = await this.prisma.municipality.update({
      where: { id },
      data,
    });

    await this.audit.log({
      userId: user.id,
      entityType: 'municipality',
      entityId: id,
      action: dto.homologated ? 'MAP_HOMOLOGATED' : 'MAP_HOMOLOGATION_REVOKED',
      beforeData: {
        mapHomologatedAt: before.mapHomologatedAt,
        mapHomologatedBy: before.mapHomologatedBy,
      },
      afterData: {
        mapHomologatedAt: updated.mapHomologatedAt,
        mapHomologatedBy: updated.mapHomologatedBy,
        notes: updated.mapHomologationNotes,
      },
    });

    invalidateDashboardIndicators(id);

    return updated;
  }
}
