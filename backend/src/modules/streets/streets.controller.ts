import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignStreetSidesDto } from './dto/assign-street-sides.dto';
import { AssignStreetsDto } from './dto/assign-streets.dto';
import { AssignNeighborhoodDto } from './dto/assign-neighborhood.dto';
import { BulkNeighborhoodDto } from './dto/bulk-neighborhood.dto';
import { BulkDemographicsDto } from './dto/bulk-demographics.dto';
import { UnassignStreetsDto } from './dto/unassign-streets.dto';
import {
  PaintStreetAtPointDto,
  UnpaintStreetAtPointDto,
} from './dto/paint-street-at-point.dto';
import { UpdateStreetDemographicsDto } from './dto/update-street-demographics.dto';
import { StreetsService } from './streets.service';

@ApiTags('Ruas')
@ApiBearerAuth()
@Controller('streets')
@UseGuards(RolesGuard)
export class StreetsController {
  constructor(private readonly streetsService: StreetsService) {}

  @Get('municipality/:municipalityId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Listar ruas do município (paginado)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'microareaId', required: false })
  @ApiQuery({ name: 'neighborhoodId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({
    name: 'mapOnly',
    required: false,
    description: 'Resposta leve para o mapa',
  })
  @ApiQuery({
    name: 'geoPrecision',
    required: false,
    description: 'Casas decimais da geometria (mapa)',
  })
  @ApiQuery({
    name: 'bbox',
    required: false,
    description: 'west,south,east,north (mapOnly)',
  })
  @ApiQuery({ name: 'minLat', required: false })
  @ApiQuery({ name: 'maxLat', required: false })
  @ApiQuery({ name: 'minLng', required: false })
  @ApiQuery({ name: 'maxLng', required: false })
  findByMunicipality(
    @Param('municipalityId') municipalityId: string,
    @Query('search') search?: string,
    @Query('microareaId') microareaId?: string,
    @Query('neighborhoodId') neighborhoodId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('mapOnly') mapOnly?: string,
    @Query('geoPrecision') geoPrecision?: number,
    @Query('bbox') bbox?: string,
    @Query('minLat') minLat?: number,
    @Query('maxLat') maxLat?: number,
    @Query('minLng') minLng?: number,
    @Query('maxLng') maxLng?: number,
    @Req() req?: { user: { id: string; role: string } },
  ) {
    return this.streetsService.findByMunicipality(
      municipalityId,
      {
        search,
        microareaId,
        neighborhoodId,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        mapOnly: mapOnly === 'true' || mapOnly === '1',
        geoPrecision: geoPrecision ? Number(geoPrecision) : undefined,
        bbox,
        minLat: minLat != null ? Number(minLat) : undefined,
        maxLat: maxLat != null ? Number(maxLat) : undefined,
        minLng: minLng != null ? Number(minLng) : undefined,
        maxLng: maxLng != null ? Number(maxLng) : undefined,
      },
      req?.user,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes de uma rua' })
  findOne(@Param('id') id: string) {
    return this.streetsService.findOne(id);
  }

  @Get(':id/suggest-microarea')
  @Roles(UserRole.ENFERMEIRO, UserRole.COORDENADOR_APS, UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Sugestão de microárea por proximidade (IA)' })
  suggest(@Param('id') id: string) {
    return this.streetsService.suggestMicroarea(id);
  }

  @Post('assign')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Vincular ruas a uma microárea' })
  assign(@Body() dto: AssignStreetsDto, @Req() req: { user: { id: string } }) {
    return this.streetsService.assignToMicroarea(
      dto,
      req.user.id,
      dto.forceTransfer ?? false,
    );
  }

  @Patch(':id/sides')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({
    summary: 'Vincular rua inteira ou dividir por lados (zona urbana)',
  })
  assignSides(
    @Param('id') id: string,
    @Body() dto: AssignStreetSidesDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.assignStreetSides(id, dto, req.user.id);
  }

  @Post('assign-neighborhood')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Vincular ruas a um bairro' })
  assignNeighborhood(
    @Body() dto: AssignNeighborhoodDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.assignToNeighborhood(dto, req.user.id);
  }

  @Patch(':id/demographics')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Atualizar famílias/habitantes de uma rua' })
  updateDemographics(
    @Param('id') id: string,
    @Body() dto: UpdateStreetDemographicsDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.updateDemographics(id, dto, req.user.id);
  }

  @Post('bulk-demographics')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Importar famílias/habitantes por rua (planilha)' })
  bulkDemographics(
    @Body() dto: BulkDemographicsDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.bulkUpdateDemographics(
      dto.municipalityId,
      dto.items,
      req.user.id,
    );
  }

  @Post('bulk-neighborhood')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Vincular ruas a bairros em lote (planilha)' })
  bulkNeighborhood(
    @Body() dto: BulkNeighborhoodDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.bulkAssignNeighborhood(
      dto.municipalityId,
      dto.items,
      req.user.id,
    );
  }

  @Post('unassign')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Remover vínculo de ruas com microáreas' })
  unassign(
    @Body() dto: UnassignStreetsDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.unassignFromMicroarea(dto, req.user.id);
  }

  @Post(':id/paint-at-point')
  @SkipThrottle()
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({
    summary: 'Pintar trecho da rua no ponto clicado (vértice mais próximo)',
  })
  paintAtPoint(
    @Param('id') id: string,
    @Body() dto: PaintStreetAtPointDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.paintAtPoint(
      id,
      dto.microareaId,
      dto.latitude,
      dto.longitude,
      req.user.id,
      dto.side,
      dto.scope ?? 'segment',
      dto.endLatitude,
      dto.endLongitude,
    );
  }

  @Post(':id/unpaint-at-point')
  @SkipThrottle()
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Remover pintura do trecho no ponto clicado' })
  unpaintAtPoint(
    @Param('id') id: string,
    @Body() dto: UnpaintStreetAtPointDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.unpaintAtPoint(
      id,
      dto.latitude,
      dto.longitude,
      req.user.id,
      undefined,
      dto.side,
      dto.endLatitude,
      dto.endLongitude,
    );
  }

  @Post('microarea/:microareaId/clear-assignments')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({
    summary: 'Remover vínculo de todas as ruas de uma microárea',
  })
  clearMicroareaAssignments(
    @Param('microareaId') microareaId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.clearMicroareaAssignments(
      microareaId,
      req.user.id,
    );
  }

  @Post('municipality/:municipalityId/clear-assignments')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Remover vínculo de todas as ruas com microáreas' })
  clearAssignments(
    @Param('municipalityId') municipalityId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.streetsService.clearAllAssignments(municipalityId, req.user.id);
  }
}
