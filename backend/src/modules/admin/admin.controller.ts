import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { BackupService } from './backup.service';

@ApiTags('Administração')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMINISTRADOR)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly backup: BackupService,
  ) {}

  @Get('municipality/:municipalityId/overview')
  @ApiOperation({ summary: 'Painel administrativo do município' })
  overview(@Param('municipalityId') municipalityId: string) {
    return this.admin.getOverview(municipalityId);
  }

  @Get('municipality/:municipalityId/backup/export')
  @ApiOperation({ summary: 'Exportar backup completo do município' })
  exportBackup(@Param('municipalityId') municipalityId: string) {
    return this.backup.exportBackup(municipalityId);
  }

  @Post('municipality/:municipalityId/backup/import')
  @ApiOperation({ summary: 'Restaurar backup do município (mescla por ID)' })
  importBackup(
    @Param('municipalityId') municipalityId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.backup.importBackup(municipalityId, payload);
  }

  @Get('municipality/:municipalityId/audit')
  @ApiOperation({ summary: 'Log de auditoria paginado' })
  audit(
    @Param('municipalityId') municipalityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.admin.getAuditLog(
      municipalityId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
