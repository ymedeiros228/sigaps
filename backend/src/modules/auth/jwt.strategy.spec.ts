import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, invalidateAuthUser } from './jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

const payload = { sub: 'user-1', email: 'a@b.c', role: 'ENFERMEIRO' };

function buildStrategy(findUnique: jest.Mock) {
  const config = { get: () => 'segredo-de-teste' } as unknown as ConfigService;
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  return new JwtStrategy(config, prisma);
}

describe('JwtStrategy (cache do usuário)', () => {
  const activeUser = {
    id: 'user-1',
    email: 'a@b.c',
    name: 'Fulano',
    role: 'ENFERMEIRO',
    municipalityId: 'm-1',
    isActive: true,
  };

  beforeEach(() => invalidateAuthUser('user-1'));

  it('consulta o banco só uma vez dentro da janela do cache', async () => {
    const findUnique = jest.fn().mockResolvedValue(activeUser);
    const strategy = buildStrategy(findUnique);

    await strategy.validate(payload);
    await strategy.validate(payload);

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('invalidateAuthUser força nova consulta e pega usuário desativado na hora', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(activeUser)
      .mockResolvedValueOnce({ ...activeUser, isActive: false });
    const strategy = buildStrategy(findUnique);

    await strategy.validate(payload);
    invalidateAuthUser('user-1');

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('não guarda em cache usuário inativo ou inexistente', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('com a função de administrador, role vira ADMINISTRADOR e o perfil fica em profileRole', async () => {
    const findUnique = jest.fn().mockResolvedValue({ ...activeUser, isAdmin: true });
    const user = await buildStrategy(findUnique).validate(payload);
    expect(user.role).toBe('ADMINISTRADOR');
    expect(user.profileRole).toBe('ENFERMEIRO');
    expect(user.isAdmin).toBe(true);
  });
});
