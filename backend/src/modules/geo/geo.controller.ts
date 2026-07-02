import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ImportGeoJsonDto } from './dto/import-geojson.dto';
import { GeoService } from './geo.service';

const IMPORT_ROLES = [
  UserRole.ENFERMEIRO,
  UserRole.COORDENADOR_APS,
  UserRole.SECRETARIO_SAUDE,
  UserRole.ADMINISTRADOR,
] as const;

@ApiTags('Importação / Exportação')
@ApiBearerAuth()
@Controller('geo')
@UseGuards(RolesGuard)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post('import/:municipalityId')
  @Roles(...IMPORT_ROLES)
  @ApiOperation({ summary: 'Importar ruas via GeoJSON' })
  importGeoJson(
    @Param('municipalityId') municipalityId: string,
    @Body() dto: ImportGeoJsonDto,
  ) {
    return this.geoService.importGeoJson(municipalityId, dto);
  }

  @Post('import/:municipalityId/kml')
  @Roles(...IMPORT_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        updateByName: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({ summary: 'Importar ruas via KML' })
  async importKml(
    @Param('municipalityId') municipalityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('updateByName') updateByName?: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Arquivo KML obrigatório');
    const content = file.buffer.toString('utf-8');
    return this.geoService.importKml(
      municipalityId,
      content,
      updateByName === 'true',
    );
  }

  @Post('import/:municipalityId/shapefile')
  @Roles(...IMPORT_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        updateByName: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({ summary: 'Importar ruas via Shapefile (.zip ou .shp)' })
  async importShapefile(
    @Param('municipalityId') municipalityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('updateByName') updateByName?: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Arquivo Shapefile obrigatório');
    return this.geoService.importShapefile(
      municipalityId,
      file.buffer,
      updateByName === 'true',
    );
  }

  @Post('import/:municipalityId/csv')
  @Roles(...IMPORT_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        updateByName: { type: 'boolean' },
      },
    },
  })
  @ApiOperation({ summary: 'Importar ruas via CSV' })
  async importCsv(
    @Param('municipalityId') municipalityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('updateByName') updateByName?: string,
  ) {
    if (!file?.buffer) throw new BadRequestException('Arquivo CSV obrigatório');
    const content = file.buffer.toString('utf-8');
    return this.geoService.importCsv(
      municipalityId,
      content,
      updateByName === 'true',
    );
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

  @Get('export/:municipalityId/kml')
  @Header('Content-Type', 'application/vnd.google-earth.kml+xml')
  @ApiOperation({ summary: 'Exportar ruas como KML' })
  @ApiQuery({ name: 'microareaId', required: false })
  async exportKml(
    @Param('municipalityId') municipalityId: string,
    @Query('microareaId') microareaId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.geoService.exportKml(municipalityId, microareaId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sigaps-ruas-${municipalityId.slice(0, 8)}.kml"`,
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
