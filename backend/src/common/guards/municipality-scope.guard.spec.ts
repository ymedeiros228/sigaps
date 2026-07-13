import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { MunicipalityScopeGuard } from './municipality-scope.guard';

function mockContext(req: {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: Record<string, unknown>;
  user?: Record<string, unknown>;
}) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as never;
}

describe('MunicipalityScopeGuard', () => {
  const reflector = { getAllAndOverride: jest.fn(() => false) } as unknown as Reflector;
  const guard = new MunicipalityScopeGuard(reflector);

  it('permite administrador em qualquer município', () => {
    const ok = guard.canActivate(
      mockContext({
        user: { role: UserRole.ADMINISTRADOR, municipalityId: 'a' },
        params: { municipalityId: 'b' },
      }),
    );
    expect(ok).toBe(true);
  });

  it('bloqueia acesso cross-tenant', () => {
    expect(() =>
      guard.canActivate(
        mockContext({
          user: { role: UserRole.COORDENADOR_APS, municipalityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
          params: { municipalityId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('permite quando municipalityId coincide', () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const ok = guard.canActivate(
      mockContext({
        user: { role: UserRole.ENFERMEIRO, municipalityId: id },
        params: { municipalityId: id },
      }),
    );
    expect(ok).toBe(true);
  });

  it('rejeita UUID inválido', () => {
    expect(() =>
      guard.canActivate(
        mockContext({
          user: { role: UserRole.COORDENADOR_APS, municipalityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
          params: { municipalityId: 'not-a-uuid' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
