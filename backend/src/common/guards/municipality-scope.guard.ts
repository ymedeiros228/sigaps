import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';

interface ScopedRequest {
  user?: { role?: string; municipalityId?: string | null };
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Impede acesso cross-tenant por troca de municipalityId na URL (exceto ADMINISTRADOR). */
@Injectable()
export class MunicipalityScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<ScopedRequest>();
    const user = req.user;
    if (!user?.role) return true;

    if (user.role === UserRole.ADMINISTRADOR) return true;

    const scopedId = this.extractMunicipalityId(req);
    if (!scopedId) return true;

    if (!UUID_RE.test(scopedId)) {
      throw new ForbiddenException('Identificador de município inválido');
    }

    if (user.municipalityId && user.municipalityId !== scopedId) {
      throw new ForbiddenException('Acesso negado a este município');
    }

    return true;
  }

  private extractMunicipalityId(req: ScopedRequest): string | null {
    const fromParam = req.params?.municipalityId;
    if (fromParam) return fromParam;

    const fromQuery = req.query?.municipalityId;
    if (typeof fromQuery === 'string' && fromQuery) return fromQuery;

    const fromBody = req.body?.municipalityId;
    if (typeof fromBody === 'string' && fromBody) return fromBody;

    return null;
  }
}
