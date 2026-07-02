import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditService } from '../../common/services/audit.service';

@ApiTags('Audit Log')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMINISTRADOR, UserRole.SECRETARIO_SAUDE)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Histórico de alterações do município' })
  findByMunicipality(
    @Param('municipalityId') municipalityId: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.findRecent(municipalityId, limit ? parseInt(limit, 10) : 20);
  }
}
