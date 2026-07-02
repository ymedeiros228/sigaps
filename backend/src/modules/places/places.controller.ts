import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePlaceDto, UpdatePlaceDto } from './dto/place.dto';
import { PlacesService } from './places.service';

@ApiTags('Povoados')
@ApiBearerAuth()
@Controller('places')
@UseGuards(RolesGuard)
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Listar povoados e localidades do município' })
  findByMunicipality(@Param('municipalityId') municipalityId: string) {
    return this.placesService.findByMunicipality(municipalityId);
  }

  @Get('nominatim')
  @ApiOperation({ summary: 'Buscar localidades no mapa mundial (Nominatim)' })
  searchNominatim(
    @Query('municipalityId') municipalityId: string,
    @Query('q') q: string,
  ) {
    return this.placesService.searchNominatim(municipalityId, q);
  }

  @Post('import-osm/:municipalityId')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE, UserRole.COORDENADOR_APS, UserRole.ENFERMEIRO)
  @ApiOperation({ summary: 'Importar povoados do OpenStreetMap (complemento)' })
  importFromOsm(
    @Param('municipalityId') municipalityId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.placesService.importFromOsm(municipalityId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do povoado' })
  findOne(@Param('id') id: string) {
    return this.placesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE, UserRole.COORDENADOR_APS, UserRole.ENFERMEIRO)
  @ApiOperation({ summary: 'Cadastrar povoado/localidade' })
  create(@Body() dto: CreatePlaceDto, @Req() req: { user: { id: string } }) {
    return this.placesService.create(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE, UserRole.COORDENADOR_APS, UserRole.ENFERMEIRO)
  @ApiOperation({ summary: 'Atualizar povoado' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlaceDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.placesService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
  @ApiOperation({ summary: 'Excluir povoado' })
  remove(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.placesService.remove(id, req.user.id);
  }
}
