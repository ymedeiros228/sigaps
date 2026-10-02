import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Evita "prepared statement already exists" no Supabase pooler (Render). */
function normalizeDatabaseUrl(raw?: string): string | undefined {
  if (!raw?.trim()) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes('pooler.supabase.com')) {
      if (!url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true');
      }
      if (!url.searchParams.has('connection_limit')) {
        // Serverless (Vercel): 1 por instância, pois várias instâncias dividem o pool do Supabase.
        // Servidor contínuo (local/Render): mais conexões evitam fila entre requisições simultâneas
        // (o mapa dispara várias chamadas em paralelo ao abrir).
        const fallback = process.env.VERCEL ? '1' : '5';
        url.searchParams.set(
          'connection_limit',
          process.env.DB_CONNECTION_LIMIT?.trim() || fallback,
        );
      }
    }
    if (!url.searchParams.has('schema')) {
      url.searchParams.set('schema', 'public');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
    super({
      datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
      log:
        process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error'],
    });
    if (datasourceUrl && datasourceUrl !== process.env.DATABASE_URL) {
      this.logger.log(
        'DATABASE_URL normalizada para pooler Supabase (pgbouncer=true)',
      );
    }
  }

  async onModuleInit() {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt === 4) throw error;
        this.logger.warn(
          `Conexão DB tentativa ${attempt + 1} falhou — retentando...`,
        );
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
