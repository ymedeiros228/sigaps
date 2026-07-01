import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMunicipalityDto } from './dto/municipality.dto';
import { MunicipalitiesService } from './municipalities.service';

@ApiTags('Municípios')
@ApiBearerAuth()
@Controller('municipalities')
@UseGuards(RolesGuard)
export class MunicipalitiesController {
  constructor(private readonly municipalitiesService: MunicipalitiesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar municípios' })
  findAll() {
    return this.municipalitiesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do município' })
  findOne(@Param('id') id: string) {
    return this.municipalitiesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMINISTRADOR)
  @ApiOperation({ summary: 'Cadastrar município' })
  create(@Body() dto: CreateMunicipalityDto) {
    return this.municipalitiesService.create(dto);
  }
}
