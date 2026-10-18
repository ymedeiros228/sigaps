import {
  Body,
  Controller,
  ForbiddenException,
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
import {
  TEAM_MANAGER_ROLES,
  canHandleRole,
} from '../../common/utils/role-rank.util';
import { AdminService } from './admin.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';

type TeamRequest = { user: { id: string; role: UserRole } };

const FORBIDDEN_ROLE =
  'Seu perfil não pode criar nem alterar contas com este perfil.';

/**
 * Equipe do município: enfermeiro, coordenação e secretaria criam as contas da equipe
 * (ACS, enfermeiros…), redefinem senha e desativam quem saiu. Usa o mesmo serviço da
 * Administração, com a trava de perfis de `canHandleRole`. O município vem da URL e o
 * MunicipalityScopeGuard global impede mexer em outro município.
 */
@ApiTags('Equipe')
@ApiBearerAuth()
@Controller('team')
@UseGuards(RolesGuard)
@Roles(...TEAM_MANAGER_ROLES)
export class TeamController {
  constructor(private readonly admin: AdminService) {}

  @Get('municipality/:municipalityId/users')
  @ApiOperation({ summary: 'Listar contas da equipe do município' })
  listUsers(@Param('municipalityId') municipalityId: string) {
    return this.admin.listUsers(municipalityId);
  }

  @Post('municipality/:municipalityId/users')
  @ApiOperation({ summary: 'Criar conta para alguém da equipe' })
  createUser(
    @Param('municipalityId') municipalityId: string,
    @Body() dto: CreateUserDto,
    @Req() req: TeamRequest,
  ) {
    if (!canHandleRole(req.user.role, dto.role))
      throw new ForbiddenException(FORBIDDEN_ROLE);
    return this.admin.createUser(municipalityId, dto, req.user.id);
  }

  @Patch('municipality/:municipalityId/users/:userId')
  @ApiOperation({
    summary: 'Alterar conta da equipe (nome, e-mail, perfil, ativo)',
  })
  async updateUser(
    @Param('municipalityId') municipalityId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateUserDto,
    @Req() req: TeamRequest,
  ) {
    const target = await this.admin.getUser(municipalityId, userId);
    if (!canHandleRole(req.user.role, target.role))
      throw new ForbiddenException(FORBIDDEN_ROLE);
    if (dto.role && !canHandleRole(req.user.role, dto.role)) {
      throw new ForbiddenException(FORBIDDEN_ROLE);
    }
    return this.admin.updateUser(municipalityId, userId, dto, req.user.id);
  }

  @Post('municipality/:municipalityId/users/:userId/reset-password')
  @ApiOperation({ summary: 'Redefinir a senha de alguém da equipe' })
  async resetPassword(
    @Param('municipalityId') municipalityId: string,
    @Param('userId') userId: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: TeamRequest,
  ) {
    const target = await this.admin.getUser(municipalityId, userId);
    if (!canHandleRole(req.user.role, target.role))
      throw new ForbiddenException(FORBIDDEN_ROLE);
    return this.admin.resetPassword(
      municipalityId,
      userId,
      dto.password,
      req.user.id,
    );
  }
}
