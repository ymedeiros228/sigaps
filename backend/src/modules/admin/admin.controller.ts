import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { BackupService } from './backup.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  @Get('municipality/:municipalityId/backup/auto')
  @ApiOperation({ summary: 'Listar backups automáticos do município' })
  listAutoBackups(@Param('municipalityId') municipalityId: string) {
    return this.backup.listAutoBackups(municipalityId);
  }

  @Post('municipality/:municipalityId/backup/auto/run')
  @ApiOperation({ summary: 'Gerar backup automático agora' })
  runAutoBackup(@Param('municipalityId') municipalityId: string) {
    return this.backup.saveAutoBackup(municipalityId);
  }

  @Get('municipality/:municipalityId/backup/auto/:filename')
  @ApiOperation({ summary: 'Baixar backup automático' })
  downloadAutoBackup(
    @Param('municipalityId') municipalityId: string,
    @Param('filename') filename: string,
  ) {
    return this.backup.readAutoBackup(municipalityId, filename);
  }

  @Get('municipality/:municipalityId/audit')
  @ApiOperation({ summary: 'Log de auditoria paginado' })
  audit(
    @Param('municipalityId') municipalityId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.getAuditLog(
      municipalityId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
      { entityType, action, userId, from, to },
    );
  }

  @Get('municipality/:municipalityId/audit/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Exportar auditoria em CSV (até 5000 registros)' })
  async exportAuditCsv(
    @Param('municipalityId') municipalityId: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const csv = await this.admin.exportAuditCsv(municipalityId, {
      entityType,
      action,
      userId,
      from,
      to,
    });
    res?.setHeader(
      'Content-Disposition',
      `attachment; filename="sigaps-auditoria-${municipalityId.slice(0, 8)}.csv"`,
    );
    return csv;
  }

  @Post('municipality/:municipalityId/users')
  @ApiOperation({ summary: 'Criar usuário do município' })
  createUser(
    @Param('municipalityId') municipalityId: string,
    @Body() dto: CreateUserDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.admin.createUser(municipalityId, dto, req.user.id);
  }

  @Patch('municipality/:municipalityId/users/:userId')
  @ApiOperation({ summary: 'Atualizar usuário do município' })
  updateUser(
    @Param('municipalityId') municipalityId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.admin.updateUser(municipalityId, userId, dto, req.user.id);
  }

  @Post('municipality/:municipalityId/users/:userId/reset-password')
  @ApiOperation({ summary: 'Redefinir senha do usuário' })
  resetPassword(
    @Param('municipalityId') municipalityId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.admin.resetPassword(municipalityId, userId, dto.password, req.user.id);
  }
}
