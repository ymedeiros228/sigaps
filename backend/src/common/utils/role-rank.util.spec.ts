import { UserRole } from '@prisma/client';
import { canHandleRole } from './role-rank.util';

describe('canHandleRole', () => {
  it('administrador pode tudo', () => {
    for (const target of Object.values(UserRole)) {
      expect(canHandleRole(UserRole.ADMINISTRADOR, target)).toBe(true);
    }
  });

  it('enfermeiro cria ACS e enfermeiro, mas não perfis acima', () => {
    expect(canHandleRole(UserRole.ENFERMEIRO, UserRole.ACS)).toBe(true);
    expect(canHandleRole(UserRole.ENFERMEIRO, UserRole.ENFERMEIRO)).toBe(true);
    expect(canHandleRole(UserRole.ENFERMEIRO, UserRole.COORDENADOR_APS)).toBe(
      false,
    );
    expect(canHandleRole(UserRole.ENFERMEIRO, UserRole.SECRETARIO_SAUDE)).toBe(
      false,
    );
  });

  it('ninguém além do administrador mexe em administrador', () => {
    expect(
      canHandleRole(UserRole.SECRETARIO_SAUDE, UserRole.ADMINISTRADOR),
    ).toBe(false);
    expect(
      canHandleRole(UserRole.COORDENADOR_APS, UserRole.ADMINISTRADOR),
    ).toBe(false);
    expect(canHandleRole(UserRole.ENFERMEIRO, UserRole.ADMINISTRADOR)).toBe(
      false,
    );
  });

  it('ACS não gerencia ninguém', () => {
    expect(canHandleRole(UserRole.ACS, UserRole.ACS)).toBe(false);
  });
});
