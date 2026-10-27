import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

const SESSION_USER_INCLUDE = {
  acsProfile: {
    include: {
      microarea: {
        select: { id: true, name: true, number: true, color: true },
      },
    },
  },
} satisfies Prisma.UserInclude;

type SessionUserRecord = Prisma.UserGetPayload<{
  include: typeof SESSION_USER_INCLUDE;
}>;

/** O que o site guarda da conta: `role` é o perfil cadastrado; `isAdmin`, a função. */
function toSessionUser(user: SessionUserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isAdmin: user.isAdmin,
    municipalityId: user.municipalityId,
    acsProfile: user.acsProfile
      ? {
          id: user.acsProfile.id,
          microarea: user.acsProfile.microarea ?? undefined,
        }
      : undefined,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: SESSION_USER_INCLUDE,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.name,
      user.municipalityId,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken },
    });

    return { user: toSessionUser(user), ...tokens };
  }

  /** Conta da sessão atual: o site relê ao abrir, para a função de administrador valer sem sair e entrar. */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: SESSION_USER_INCLUDE,
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Sessão inválida ou usuário inativo');
    }
    return toSessionUser(user);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Token inválido');
      }
      return this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.name,
        user.municipalityId,
      );
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    name?: string,
    municipalityId?: string | null,
  ) {
    const payload = { sub: userId, email, role, name, municipalityId };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
