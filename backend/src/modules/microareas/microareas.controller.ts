import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMicroareaDto, UpdateMicroareaDto } from './dto/microarea.dto';
import { MicroareasService } from './microareas.service';

@ApiTags('Microáreas')
@ApiBearerAuth()
@Controller('microareas')
@UseGuards(RolesGuard)
export class MicroareasController {
  constructor(private readonly microareasService: MicroareasService) {}

  @Get('municipality/:municipalityId')
  @SkipThrottle()
  @ApiOperation({ summary: 'Listar microáreas do município' })
  findByMunicipality(
    @Param('municipalityId') municipalityId: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    return this.microareasService.findByMunicipality(municipalityId, req.user);
  }

  @Get('municipality/:municipalityId/envelopes')
  @SkipThrottle()
  @ApiOperation({ summary: 'Polígonos de todas as microáreas (PostGIS, uma query)' })
  listEnvelopes(@Param('municipalityId') municipalityId: string) {
    return this.microareasService.listEnvelopesByMunicipality(municipalityId);
  }

  @Post('municipality/:municipalityId/rebuild-envelopes')
  @Roles(
    UserRole.ENFERMEIRO,
    UserRole.COORDENADOR_APS,
    UserRole.SECRETARIO_SAUDE,
    UserRole.ADMINISTRADOR,
  )
  @ApiOperation({ summary: 'Recalcular polígonos das microáreas e limpar órfãos' })
  rebuildEnvelopes(@Param('municipalityId') municipalityId: string) {
    return this.microareasService.rebuildEnvelopes(municipalityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da microárea' })
  findOne(@Param('id') id: string, @Req() req: { user: { role: string } }) {
    return this.microareasService.findOne(id, req.user.role);
  }

  @Get(':id/envelope')
  @ApiOperation({ summary: 'Polígono automático envolvendo as ruas' })
  getEnvelope(@Param('id') id: string) {
    return this.microareasService.getEnvelopeGeoJson(id);
  }

  @Post()
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Criar microárea' })
  create(@Body() dto: CreateMicroareaDto, @Req() req: { user: { id: string } }) {
    return this.microareasService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Atualizar microárea' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMicroareaDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.microareasService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Excluir microárea' })
  remove(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.microareasService.remove(id, req.user.id);
  }
}
