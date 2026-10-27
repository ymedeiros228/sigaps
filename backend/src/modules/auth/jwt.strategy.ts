import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { accessRole } from '../../common/utils/role-rank.util';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name?: string;
  municipalityId?: string | null;
}

type AuthUser = {
  id: string;
  email: string;
  name: string;
  /** Perfil de acesso (`accessRole`): com a função de administrador, vale ADMINISTRADOR. */
  role: string;
  /** Perfil cadastrado (Enfermeiro, ACS…), sem a função de administrador. */
  profileRole: string;
  isAdmin: boolean;
  municipalityId: string | null;
  isActive: boolean;
};

/**
 * Cache curto do usuário validado: evita uma ida ao banco em TODA requisição autenticada.
 * Janela pequena — desativar um usuário passa a valer em até 15 s.
 */
const USER_CACHE_TTL_MS = 15_000;
const USER_CACHE_MAX = 500;
const userCache = new Map<string, { user: AuthUser; expires: number }>();

/**
 * Descarta o usuário em cache assim que ele é alterado (papel, ativo/inativo, senha),
 * para a mudança valer na hora nesta instância. Em ambiente com várias instâncias
 * (serverless), as demais respeitam o TTL de 15 s.
 */
export function invalidateAuthUser(userId: string): void {
  userCache.delete(userId);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    const cached = userCache.get(payload.sub);
    if (cached && cached.expires > Date.now()) return cached.user;

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        municipalityId: true,
        isActive: true,
        isAdmin: true,
      },
    });

    if (!user || !user.isActive) {
      userCache.delete(payload.sub);
      throw new UnauthorizedException('Sessão inválida ou usuário inativo');
    }

    // Guards e controllers leem `role`: quem tem a função de administrador passa
    // em tudo o que o ADMINISTRADOR passa, sem mudar nada rota por rota.
    const validated: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: accessRole(user),
      profileRole: user.role,
      isAdmin: user.isAdmin,
      municipalityId: user.municipalityId,
      isActive: user.isActive,
    };
    if (userCache.size >= USER_CACHE_MAX) userCache.clear();
    userCache.set(payload.sub, {
      user: validated,
      expires: Date.now() + USER_CACHE_TTL_MS,
    });
    return validated;
  }
}
