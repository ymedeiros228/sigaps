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
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUbsDto, UpdateUbsDto } from './dto/ubs.dto';
import { BulkUbsImportDto } from './dto/bulk-ubs.dto';
import { UbsService } from './ubs.service';

@ApiTags('UBS')
@ApiBearerAuth()
@Controller('ubs')
@UseGuards(RolesGuard)
export class UbsController {
  constructor(private readonly ubsService: UbsService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Listar UBS do município' })
  findByMunicipality(@Param('municipalityId') municipalityId: string) {
    return this.ubsService.findByMunicipality(municipalityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da UBS' })
  findOne(@Param('id') id: string) {
    return this.ubsService.findOne(id);
  }

  @Post()
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
  )
  @ApiOperation({ summary: 'Cadastrar UBS' })
  create(@Body() dto: CreateUbsDto, @Req() req: { user: { id: string } }) {
    return this.ubsService.create(dto, req.user.id);
  }

  @Post('bulk')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
  )
  @ApiOperation({
    summary: 'Importar várias UBS de planilha (nome + coordenadas)',
  })
  bulkImport(
    @Body() dto: BulkUbsImportDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.ubsService.bulkImport(dto, req.user.id);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
  )
  @ApiOperation({ summary: 'Atualizar UBS' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUbsDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.ubsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
  )
  @ApiOperation({ summary: 'Excluir UBS' })
  remove(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.ubsService.remove(id, req.user.id);
  }
}
