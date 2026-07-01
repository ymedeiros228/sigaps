import {
  Body,
  Controller,
  Get,
  Param,
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
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findByMunicipality(
    @Param('municipalityId') municipalityId: string,
    @Query('search') search?: string,
    @Query('microareaId') microareaId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.streetsService.findByMunicipality(municipalityId, {
      search,
      microareaId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
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
}
