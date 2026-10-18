import { UserRole } from '@prisma/client';
import { canHandleRole, canManageAccount } from './role-rank.util';

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

  it('conta existente: só perfil abaixo ou a própria (enfermeiro não toma a conta de outro)', () => {
    const enf = { id: 'a', role: UserRole.ENFERMEIRO };
    expect(canManageAccount(enf, { id: 'b', role: UserRole.ACS })).toBe(true);
    expect(canManageAccount(enf, { id: 'c', role: UserRole.ENFERMEIRO })).toBe(
      false,
    );
    expect(canManageAccount(enf, { id: 'a', role: UserRole.ENFERMEIRO })).toBe(
      true,
    );
    expect(
      canManageAccount(enf, { id: 'd', role: UserRole.ADMINISTRADOR }),
    ).toBe(false);
    const adm = { id: 'x', role: UserRole.ADMINISTRADOR };
    expect(
      canManageAccount(adm, { id: 'y', role: UserRole.ADMINISTRADOR }),
    ).toBe(true);
  });

  it('ACS não gerencia ninguém', () => {
    expect(canHandleRole(UserRole.ACS, UserRole.ACS)).toBe(false);
  });
});
