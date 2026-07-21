import { auditSnapshot } from './audit-snapshot.util';

describe('auditSnapshot', () => {
  it('remove campos sensíveis', () => {
    const result = auditSnapshot({
      name: 'Maria',
      passwordHash: 'hash',
      refreshToken: 'token',
      cpf: '12345678901',
    });

    expect(result).toEqual({
      name: 'Maria',
      cpf: '***.***.***-01',
    });
  });

  it('mascara CPF em snapshot parcial', () => {
    const result = auditSnapshot({ cpf: '98765432100', name: 'João' }, [
      'cpf',
      'name',
    ]);
    expect(result).toEqual({
      cpf: '***.***.***-00',
      name: 'João',
    });
  });
});
