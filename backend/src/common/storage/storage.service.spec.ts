import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { StorageService } from './storage.service';

function makeStorage(env: Record<string, string | undefined>) {
  return new StorageService({
    get: (key: string) => env[key],
  } as unknown as ConfigService);
}

describe('StorageService — disco local', () => {
  let dir: string;
  let cwdSpy: jest.SpyInstance;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sigaps-storage-'));
    cwdSpy = jest.spyOn(process, 'cwd').mockReturnValue(dir);
  });

  afterEach(async () => {
    cwdSpy.mockRestore();
    await rm(dir, { recursive: true, force: true });
  });

  it('grava imagem pública e devolve URL /uploads com versão', async () => {
    const storage = makeStorage({});
    expect(storage.isRemote).toBe(false);
    const url = await storage.putPublic(
      'logos/m1.png',
      Buffer.from('x'),
      'image/png',
    );
    expect(url).toMatch(/^\/uploads\/logos\/m1\.png\?v=\d+$/);
  });

  it('grava, lista, lê e remove arquivos privados', async () => {
    const storage = makeStorage({});
    await storage.putPrivate(
      'backups/m1/auto-a.json',
      '{"a":1}',
      'application/json',
    );
    const items = await storage.listPrivate('backups/m1/');
    expect(items.map((i) => i.name)).toEqual(['auto-a.json']);
    expect(items[0].sizeBytes).toBe(7);
    const raw = await storage.getPrivate('backups/m1/auto-a.json');
    expect(raw?.toString()).toBe('{"a":1}');

    await storage.removePrivate(['backups/m1/auto-a.json']);
    expect(await storage.getPrivate('backups/m1/auto-a.json')).toBeNull();
    expect(await storage.listPrivate('backups/inexistente')).toEqual([]);
  });
});

describe('StorageService — Supabase Storage', () => {
  const env = {
    SUPABASE_URL: 'https://proj.supabase.co/',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJ.service-key',
  };
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() =>
      Promise.resolve(new Response('{}', { status: 200 })),
    );
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('envia ao bucket público e devolve a URL pública', async () => {
    const storage = makeStorage(env);
    expect(storage.isRemote).toBe(true);
    const url = await storage.putPublic(
      'acs/a 1.jpg',
      Buffer.from('x'),
      'image/jpeg',
    );

    expect(url).toMatch(
      /^https:\/\/proj\.supabase\.co\/storage\/v1\/object\/public\/sigaps-public\/acs\/a%201\.jpg\?v=\d+$/,
    );
    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    // 2 buckets criados na primeira escrita + o upload
    expect(calls.map(([u]) => u)).toEqual([
      'https://proj.supabase.co/storage/v1/bucket',
      'https://proj.supabase.co/storage/v1/bucket',
      'https://proj.supabase.co/storage/v1/object/sigaps-public/acs/a%201.jpg',
    ]);
    const headers = calls[2][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer eyJ.service-key');
    expect(headers['x-upsert']).toBe('true');
  });

  it('chave nova sb_secret_ vai só no apikey', async () => {
    const storage = makeStorage({
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc',
    });
    await storage.putPrivate('backups/m1/a.json', '{}', 'application/json');
    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    const headers = calls[calls.length - 1][1].headers as Record<
      string,
      string
    >;
    expect(headers.apikey).toBe('sb_secret_abc');
    expect(headers.Authorization).toBeUndefined();
  });

  it('ignora bucket já existente e só cria uma vez', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        new Response('{}', { status: url.endsWith('/bucket') ? 409 : 200 }),
      ),
    );
    const storage = makeStorage(env);
    await storage.putPrivate('backups/m1/a.json', '{}', 'application/json');
    await storage.putPrivate('backups/m1/b.json', '{}', 'application/json');
    const bucketCalls = fetchMock.mock.calls.filter(([u]) =>
      String(u).endsWith('/bucket'),
    );
    expect(bucketCalls).toHaveLength(2);
  });

  it('lista ignorando subpastas e devolve null para arquivo inexistente', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/object/list/')) {
        return Promise.resolve(
          Response.json([
            { name: 'sub', id: null, created_at: null, metadata: null },
            {
              name: 'auto-1.json',
              id: 'x',
              created_at: '2026-10-01T00:00:00Z',
              metadata: { size: 42 },
            },
          ]),
        );
      }
      if (url.endsWith('/bucket')) {
        return Promise.resolve(new Response('{}', { status: 409 }));
      }
      return Promise.resolve(new Response('not found', { status: 404 }));
    });
    const storage = makeStorage(env);

    expect(await storage.listPrivate('backups/m1/')).toEqual([
      { name: 'auto-1.json', sizeBytes: 42, createdAt: '2026-10-01T00:00:00Z' },
    ]);
    expect(await storage.getPrivate('backups/m1/nada.json')).toBeNull();
  });

  it('propaga erro do Supabase no upload', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        new Response('boom', { status: url.endsWith('/bucket') ? 200 : 500 }),
      ),
    );
    const storage = makeStorage(env);
    await expect(
      storage.putPublic('logos/x.png', Buffer.from('x'), 'image/png'),
    ).rejects.toThrow(/Supabase Storage falhou.*500/);
  });
});
