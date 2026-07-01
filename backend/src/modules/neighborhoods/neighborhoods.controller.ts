import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateNeighborhoodDto, UpdateNeighborhoodDto } from './dto/neighborhood.dto';
import { NeighborhoodsService } from './neighborhoods.service';

@ApiTags('Bairros')
@ApiBearerAuth()
@Controller('neighborhoods')
@UseGuards(RolesGuard)
export class NeighborhoodsController {
  constructor(private readonly neighborhoodsService: NeighborhoodsService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Listar bairros do município' })
  findByMunicipality(@Param('municipalityId') municipalityId: string) {
    return this.neighborhoodsService.findByMunicipality(municipalityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do bairro' })
  findOne(@Param('id') id: string) {
    return this.neighborhoodsService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE, UserRole.COORDENADOR_APS)
  @ApiOperation({ summary: 'Cadastrar bairro' })
  create(@Body() dto: CreateNeighborhoodDto) {
    return this.neighborhoodsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE, UserRole.COORDENADOR_APS)
  @ApiOperation({ summary: 'Atualizar bairro' })
  update(@Param('id') id: string, @Body() dto: UpdateNeighborhoodDto) {
    return this.neighborhoodsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
  @ApiOperation({ summary: 'Excluir bairro' })
  remove(@Param('id') id: string) {
    return this.neighborhoodsService.remove(id);
  }
}
