import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CnesService } from './cnes.service';
import { EsusService } from './esus.service';

@ApiTags('Integrações')
@ApiBearerAuth()
@Controller('integrations')
@UseGuards(RolesGuard)
export class IntegrationsController {
  constructor(
    private readonly cnes: CnesService,
    private readonly esus: EsusService,
  ) {}

  @Get('cnes/:code')
  @ApiOperation({ summary: 'Consultar estabelecimento no CNES (dados abertos MS)' })
  lookupCnes(@Param('code') code: string) {
    return this.cnes.lookup(code);
  }

  @Post('esus/import/:municipalityId')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Importar famílias/habitantes via CSV piloto e-SUS' })
  importEsus(
    @Param('municipalityId') municipalityId: string,
    @Body() body: { csv: string },
    @Req() req: { user: { id: string } },
  ) {
    return this.esus.importCsv(municipalityId, body.csv, req.user.id);
  }
}
