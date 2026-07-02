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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssignStreetsDto } from './dto/assign-streets.dto';
import { AssignNeighborhoodDto } from './dto/assign-neighborhood.dto';
import { BulkNeighborhoodDto } from './dto/bulk-neighborhood.dto';
import { BulkDemographicsDto } from './dto/bulk-demographics.dto';
import { UnassignStreetsDto } from './dto/unassign-streets.dto';
import { UpdateStreetDemographicsDto } from './dto/update-street-demographics.dto';
import { StreetsService } from './streets.service';

@ApiTags('Ruas')
@ApiBearerAuth()
@Controller('streets')
@UseGuards(RolesGuard)
export class StreetsController {
  constructor(private readonly streetsService: StreetsService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Listar ruas do município (paginado)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'microareaId', required: false })
  @ApiQuery({ name: 'neighborhoodId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'mapOnly', required: false, description: 'Resposta leve para o mapa' })
  findByMunicipality(
    @Param('municipalityId') municipalityId: string,
    @Query('search') search?: string,
    @Query('microareaId') microareaId?: string,
    @Query('neighborhoodId') neighborhoodId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('mapOnly') mapOnly?: string,
  ) {
    return this.streetsService.findByMunicipality(municipalityId, {
      search,
      microareaId,
      neighborhoodId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      mapOnly: mapOnly === 'true' || mapOnly === '1',
    });
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
  unassign(@Body() dto: UnassignStreetsDto, @Req() req: { user: { id: string } }) {
    return this.streetsService.unassignFromMicroarea(dto, req.user.id);
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
