import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaintCircleDto } from './dto/paint-circle.dto';
import { PaintZonesService } from './paint-zones.service';

@ApiTags('Zonas de pintura')
@ApiBearerAuth()
@Controller('paint-zones')
@UseGuards(RolesGuard)
export class PaintZonesController {
  constructor(private readonly paintZonesService: PaintZonesService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Listar divisões de mapa' })
  list(@Param('municipalityId') municipalityId: string) {
    return this.paintZonesService.listByMunicipality(municipalityId);
  }

  @Post('municipality/:municipalityId/circle')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Criar divisão circular no mapa' })
  createCircle(
    @Param('municipalityId') municipalityId: string,
    @Body() dto: PaintCircleDto,
  ) {
    return this.paintZonesService.createCircle(municipalityId, dto);
  }

  @Delete('municipality/:municipalityId')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Remover todas as divisões de mapa do município' })
  clearAll(@Param('municipalityId') municipalityId: string) {
    return this.paintZonesService.clearByMunicipality(municipalityId);
  }

  @Delete(':id')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Remover divisão de mapa' })
  remove(@Param('id') id: string) {
    return this.paintZonesService.remove(id);
  }
}
