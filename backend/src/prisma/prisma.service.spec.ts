import { classifyDbError, PrismaService } from './prisma.service';

describe('classifyDbError', () => {
  it.each([
    ['error: Environment variable not found: DATABASE_URL.', 'not_configured'],
    [
      'FATAL: (ENOTFOUND) tenant/user postgres.x not found',
      'paused_or_not_found',
    ],
    ['password authentication failed for user "postgres"', 'auth_failed'],
    ["Can't reach database server", 'unreachable'],
  ])('%s → %s', (message, reason) => {
    expect(classifyDbError(new Error(message))).toBe(reason);
  });
});

describe('PrismaService.onModuleInit', () => {
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it('não derruba a API quando o banco está fora (uma tentativa no Vercel)', async () => {
    process.env.VERCEL = '1';
    const service = new PrismaService();
    const connect = jest
      .spyOn(service, '$connect')
      .mockRejectedValue(new Error('tenant/user postgres.x not found'));
    jest.spyOn(service['logger'], 'error').mockImplementation(() => {});

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
