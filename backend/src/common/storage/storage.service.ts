import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

/** Content-Type definido pelo servidor (nunca o mimetype enviado pelo cliente). */
const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export function imageContentType(ext: string) {
  return IMAGE_CONTENT_TYPES[ext.toLowerCase()] ?? 'application/octet-stream';
}

export type StoredObject = {
  name: string;
  sizeBytes: number;
  createdAt: string;
};

/**
 * Armazenamento de arquivos (fotos de ACS, logos, backups automáticos).
 *
 * - Com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: Supabase Storage (necessário no
 *   Vercel, onde o disco é efêmero). Bucket público para imagens e privado para backups.
 * - Sem essas variáveis: disco local em ./uploads (dev e Docker), como antes.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly supabaseUrl: string | null;
  private readonly serviceKey: string | null;
  readonly publicBucket: string;
  readonly privateBucket: string;
  private bucketsReady: Promise<void> | null = null;

  constructor(config: ConfigService) {
    this.supabaseUrl =
      config.get<string>('SUPABASE_URL')?.trim().replace(/\/$/, '') || null;
    this.serviceKey =
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() || null;
    this.publicBucket =
      config.get<string>('STORAGE_PUBLIC_BUCKET')?.trim() || 'sigaps-public';
    this.privateBucket =
      config.get<string>('STORAGE_PRIVATE_BUCKET')?.trim() || 'sigaps-private';

    if (!this.isRemote && process.env.VERCEL) {
      this.logger.warn(
        'Storage em disco local no Vercel: uploads e backups NÃO persistem. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
  }

  get isRemote() {
    return Boolean(this.supabaseUrl && this.serviceKey);
  }

  /** Grava um arquivo público e devolve a URL (absoluta no Supabase, /uploads/... local). */
  async putPublic(key: string, data: Buffer, contentType: string) {
    const version = Date.now(); // evita cache do navegador ao trocar a imagem
    if (!this.isRemote) {
      await this.writeLocal(key, data);
      return `/uploads/${key}?v=${version}`;
    }
    await this.upload(this.publicBucket, key, data, contentType);
    return `${this.supabaseUrl}/storage/v1/object/public/${this.publicBucket}/${encodeKey(key)}?v=${version}`;
  }

  async putPrivate(key: string, data: Buffer | string, contentType: string) {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    if (!this.isRemote) {
      await this.writeLocal(key, buffer);
      return;
    }
    await this.upload(this.privateBucket, key, buffer, contentType);
  }

  /** Lê um arquivo privado; null se não existir. */
  async getPrivate(key: string): Promise<Buffer | null> {
    if (!this.isRemote) {
      try {
        return await readFile(this.localPath(key));
      } catch {
        return null;
      }
    }
    const res = await this.request(
      'GET',
      `/object/${this.privateBucket}/${encodeKey(key)}`,
    );
    if (res.status === 404 || res.status === 400) return null;
    await assertOk(res, `ler ${key}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /** Lista arquivos de uma "pasta" privada, do mais novo para o mais antigo. */
  async listPrivate(prefix: string): Promise<StoredObject[]> {
    const folder = prefix.replace(/\/$/, '');
    if (!this.isRemote) {
      const dir = this.localPath(folder);
      try {
        const files = await readdir(dir);
        const items = await Promise.all(
          files.map(async (name) => {
            const info = await stat(join(dir, name));
            return {
              name,
              sizeBytes: info.size,
              createdAt: info.mtime.toISOString(),
            };
          }),
        );
        return sortNewestFirst(items);
      } catch {
        return [];
      }
    }

    await this.ensureBuckets();
    const res = await this.request(
      'POST',
      `/object/list/${this.privateBucket}`,
      JSON.stringify({
        prefix: folder,
        limit: 1000,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      }),
      'application/json',
    );
    await assertOk(res, `listar ${folder}`);
    const rows = (await res.json()) as Array<{
      name: string;
      id: string | null;
      created_at: string | null;
      metadata: { size?: number } | null;
    }>;
    return sortNewestFirst(
      rows
        .filter((r) => r.id) // id nulo = subpasta
        .map((r) => ({
          name: r.name,
          sizeBytes: r.metadata?.size ?? 0,
          createdAt: r.created_at ?? new Date(0).toISOString(),
        })),
    );
  }

  async removePrivate(keys: string[]) {
    if (keys.length === 0) return;
    if (!this.isRemote) {
      await Promise.all(
        keys.map((key) => unlink(this.localPath(key)).catch(() => {})),
      );
      return;
    }
    const res = await this.request(
      'DELETE',
      `/object/${this.privateBucket}`,
      JSON.stringify({ prefixes: keys }),
      'application/json',
    );
    await assertOk(res, 'remover backups antigos');
  }

  private localPath(key: string) {
    return join(process.cwd(), 'uploads', ...key.split('/'));
  }

  private async writeLocal(key: string, data: Buffer) {
    const path = this.localPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  private async upload(
    bucket: string,
    key: string,
    data: Buffer,
    contentType: string,
  ) {
    await this.ensureBuckets();
    const res = await this.request(
      'POST',
      `/object/${bucket}/${encodeKey(key)}`,
      data,
      contentType,
      { 'x-upsert': 'true', 'cache-control': '3600' },
    );
    await assertOk(res, `enviar ${key}`);
  }

  /** Cria os buckets na primeira escrita (ignora "já existe"). */
  private ensureBuckets() {
    this.bucketsReady ??= (async () => {
      for (const [id, isPublic] of [
        [this.publicBucket, true],
        [this.privateBucket, false],
      ] as const) {
        const res = await this.request(
          'POST',
          '/bucket',
          JSON.stringify({ id, name: id, public: isPublic }),
          'application/json',
        );
        if (!res.ok && res.status !== 409 && res.status !== 400) {
          await assertOk(res, `criar bucket ${id}`);
        }
      }
    })().catch((error) => {
      this.bucketsReady = null;
      throw error;
    });
    return this.bucketsReady;
  }

  private request(
    method: string,
    path: string,
    body?: Buffer | string,
    contentType?: string,
    extraHeaders: Record<string, string> = {},
  ) {
    const headers: Record<string, string> = {
      apikey: this.serviceKey!,
      ...extraHeaders,
    };
    // Chave antiga (service_role) é um JWT e vai também no Authorization.
    // A nova (sb_secret_...) só vale no apikey: no Authorization ela é recusada.
    if (this.serviceKey!.startsWith('eyJ')) {
      headers.Authorization = `Bearer ${this.serviceKey}`;
    }
    if (contentType) headers['Content-Type'] = contentType;
    return fetch(`${this.supabaseUrl}/storage/v1${path}`, {
      method,
      headers,
      body: body as BodyInit | undefined,
      signal: AbortSignal.timeout(30_000),
    });
  }
}

function encodeKey(key: string) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function sortNewestFirst(items: StoredObject[]) {
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function assertOk(res: Response, action: string) {
  if (res.ok) return;
  const detail = await res.text().catch(() => '');
  throw new Error(
    `Supabase Storage falhou ao ${action}: ${res.status} ${detail.slice(0, 200)}`,
  );
}
