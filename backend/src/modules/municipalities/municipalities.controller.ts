import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMunicipalityDto } from './dto/municipality.dto';
import { MapHomologationDto } from './dto/map-homologation.dto';
import { UpdateMunicipalityDto } from './dto/update-municipality.dto';
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

  @Patch(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
  @ApiOperation({ summary: 'Atualizar município' })
  update(@Param('id') id: string, @Body() dto: UpdateMunicipalityDto) {
    return this.municipalitiesService.update(id, dto);
  }

  @Post(':id/logo')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload do logotipo do município' })
  uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.municipalitiesService.uploadLogo(id, file);
  }

  @Patch(':id/map-homologation')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
  @ApiOperation({ summary: 'Homologar ou revogar mapa oficial da SMS' })
  setMapHomologation(
    @Param('id') id: string,
    @Body() dto: MapHomologationDto,
    @Req() req: { user: { id: string; name: string } },
  ) {
    return this.municipalitiesService.setMapHomologation(id, dto, req.user);
  }
}
