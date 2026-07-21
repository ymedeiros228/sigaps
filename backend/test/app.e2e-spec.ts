import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const prismaMock = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $queryRaw: jest.fn().mockRejectedValue(new Error('db unavailable in e2e')),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
};

describe('SIGAPS API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'sigaps-e2e-test-secret';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://sigaps:sigaps@127.0.0.1:5432/sigaps_test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 30_000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('GET /health retorna ok', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as { ok: boolean; ts: number };
        expect(body.ok).toBe(true);
        expect(typeof body.ts).toBe('number');
      });
  });

  it('GET /health/postgis não expõe mensagem de erro em falha', async () => {
    const res = await request(app.getHttpServer()).get('/health/postgis');
    const body = res.body as { ok: boolean; error?: unknown };
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error).toBeUndefined();
  });

  it('POST /auth/login rejeita corpo inválido', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
  });
});
