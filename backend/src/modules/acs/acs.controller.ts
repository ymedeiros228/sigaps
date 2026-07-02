import {
  Body,
  Controller,
  Delete,
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
import { CreateAcsDto, UpdateAcsDto } from './dto/acs.dto';
import { BulkAcsImportDto } from './dto/bulk-acs.dto';
import { AcsService } from './acs.service';

@ApiTags('ACS')
@ApiBearerAuth()
@Controller('acs')
@UseGuards(RolesGuard)
export class AcsController {
  constructor(private readonly acsService: AcsService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Listar ACS do município' })
  findByMunicipality(@Param('municipalityId') municipalityId: string) {
    return this.acsService.findByMunicipality(municipalityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes do ACS' })
  findOne(@Param('id') id: string) {
    return this.acsService.findOne(id);
  }

  @Post()
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Cadastrar ACS' })
  create(@Body() dto: CreateAcsDto, @Req() req: { user: { id: string } }) {
    return this.acsService.create(dto, req.user.id);
  }

  @Post('bulk')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Importar vários ACS de uma vez (planilha)' })
  bulkImport(@Body() dto: BulkAcsImportDto, @Req() req: { user: { id: string } }) {
    return this.acsService.bulkImport(dto, req.user.id);
  }

  @Post(':id/photo')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload da foto do ACS' })
  uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user: { id: string } },
  ) {
    return this.acsService.uploadPhoto(id, file, req.user.id);
  }

  @Patch(':id')
  @Roles(
    UserRole.ADMINISTRADOR,
    UserRole.SECRETARIO_SAUDE,
    UserRole.COORDENADOR_APS,
    UserRole.ENFERMEIRO,
  )
  @ApiOperation({ summary: 'Atualizar ACS' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcsDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.acsService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
  @ApiOperation({ summary: 'Excluir ACS' })
  remove(@Param('id') id: string, @Req() req: { user: { id: string } }) {
    return this.acsService.remove(id, req.user.id);
  }
}
