import { describe, expect, it } from 'vitest';
import {
  accessRole,
  assignableRoles,
  canAccessAdmin,
  canGrantAdmin,
  canManageAccount,
  formatAccountRoles,
} from './permissions';

const jonas = { id: 'j', role: 'ENFERMEIRO', isAdmin: true };
const enfermeira = { id: 'e', role: 'ENFERMEIRO', isAdmin: false };
const coordenador = { id: 'c', role: 'COORDENADOR_APS' };
const admin = { id: 'a', role: 'ADMINISTRADOR' };

describe('função de administrador', () => {
  it('enfermeiro com a função tem o acesso do administrador', () => {
    expect(accessRole(jonas)).toBe('ADMINISTRADOR');
    expect(canAccessAdmin(accessRole(jonas))).toBe(true);
    expect(assignableRoles(accessRole(jonas))).toContain('ADMINISTRADOR');
  });

  it('sem a função, vale o perfil; o ACS nunca recebe a função', () => {
    expect(accessRole(enfermeira)).toBe('ENFERMEIRO');
    expect(canAccessAdmin(accessRole(enfermeira))).toBe(false);
    expect(accessRole({ role: 'ACS', isAdmin: true })).toBe('ACS');
  });

  it('quem tem a função edita qualquer conta, inclusive a do administrador', () => {
    expect(canManageAccount(jonas, admin)).toBe(true);
    expect(canManageAccount(jonas, enfermeira)).toBe(true);
  });

  it('coordenador sem a função não mexe em quem tem a função', () => {
    expect(canManageAccount(coordenador, jonas)).toBe(false);
    expect(canManageAccount(coordenador, enfermeira)).toBe(true);
  });

  it('só quem tem acesso de administrador dá ou tira a função', () => {
    expect(canGrantAdmin(jonas)).toBe(true);
    expect(canGrantAdmin(admin)).toBe(true);
    expect(canGrantAdmin(enfermeira)).toBe(false);
    expect(canGrantAdmin(coordenador)).toBe(false);
  });

  it('mostra o perfil com a função ao lado', () => {
    expect(formatAccountRoles(jonas)).toBe('Enfermeiro · Administrador');
    expect(formatAccountRoles(enfermeira)).toBe('Enfermeiro');
    expect(formatAccountRoles(admin)).toBe('Administrador');
  });
});
