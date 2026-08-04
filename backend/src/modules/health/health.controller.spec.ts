import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    prisma.$queryRaw.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('check returns ok, uptime and optional commit', () => {
    process.env.GIT_COMMIT = 'abc123';
    const result = controller.check();
    expect(result.ok).toBe(true);
    expect(typeof result.ts).toBe('number');
    expect(typeof result.uptimeSec).toBe('number');
    expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
    expect(result.commit).toBe('abc123');
    expect(result.env).toBeDefined();
  });

  it('db returns ok when prisma responds', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    await expect(controller.db()).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it('db returns ok false when prisma throws', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('down'));
    await expect(controller.db()).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
  });
});
