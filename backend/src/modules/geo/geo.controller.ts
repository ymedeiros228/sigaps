import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ImportGeoJsonDto } from './dto/import-geojson.dto';
import { GeoService } from './geo.service';

@ApiTags('Importação / Exportação')
@ApiBearerAuth()
@Controller('geo')
@UseGuards(RolesGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post('import/:municipalityId')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Importar ruas via GeoJSON' })
  importGeoJson(
    @Param('municipalityId') municipalityId: string,
    @Body() dto: ImportGeoJsonDto,
  ) {
    return this.geoService.importGeoJson(municipalityId, dto);
  }

  @Get('export/:municipalityId')
  @Header('Content-Type', 'application/geo+json')
  @ApiOperation({ summary: 'Exportar ruas como GeoJSON' })
  @ApiQuery({ name: 'microareaId', required: false })
  async exportGeoJson(
    @Param('municipalityId') municipalityId: string,
    @Query('microareaId') microareaId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geoService.exportGeoJson(municipalityId, microareaId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sigaps-ruas-${municipalityId.slice(0, 8)}.geojson"`,
    );
    return data;
  }

  @Get('export/:municipalityId/microareas')
  @Header('Content-Type', 'application/geo+json')
  @ApiOperation({ summary: 'Exportar polígonos das microáreas como GeoJSON' })
  async exportMicroareas(
    @Param('municipalityId') municipalityId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geoService.exportMicroareasGeoJson(municipalityId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sigaps-microareas-${municipalityId.slice(0, 8)}.geojson"`,
    );
    return data;
  }
}
