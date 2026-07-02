import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CadastrosService } from './cadastros.service';

@ApiTags('Cadastros')
@ApiBearerAuth()
@Controller('cadastros')
@UseGuards(RolesGuard)
export class CadastrosController {
  constructor(private readonly cadastrosService: CadastrosService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Pacote completo para a tela de Cadastros (1 request)' })
  getBundle(
    @Param('municipalityId') municipalityId: string,
    @Req() req: { user: { id: string; role: string } },
  ) {
    return this.cadastrosService.getMunicipalityBundle(
      municipalityId,
      req.user,
      req.user.role,
    );
  }
}
