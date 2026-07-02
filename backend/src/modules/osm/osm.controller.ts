import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OsmImportService } from './osm-import.service';

@ApiTags('Importação OSM')
@ApiBearerAuth()
@Controller('osm')
@UseGuards(RolesGuard)
export class OsmController {
  constructor(private readonly osmImportService: OsmImportService) {}

  @Post('import/:municipalityId')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({
    summary: 'Importar ruas do OpenStreetMap para o município',
  })
  importStreets(
    @Param('municipalityId') municipalityId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.osmImportService.importStreetsForMunicipality(
      municipalityId,
      req.user.id,
    );
  }
}
