import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

/** Evita cold start no Render free tier (~15 min de inatividade). */
@Injectable()
export class KeepAliveService {
  private readonly logger = new Logger(KeepAliveService.name);

  constructor(private readonly config: ConfigService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async pingHealth(): Promise<void> {
    const url =
      this.config.get<string>('KEEP_ALIVE_URL')?.trim() ||
      this.config.get<string>('SIGAPS_KEEP_ALIVE_URL')?.trim() ||
      this.config.get<string>('RENDER_EXTERNAL_URL')?.trim();
    if (!url) return;

    const target = `${url.replace(/\/$/, '')}/health`;
    try {
      const res = await fetch(target, { signal: AbortSignal.timeout(25_000) });
      if (!res.ok) {
        this.logger.warn(`Keep-alive: ${target} respondeu ${res.status}`);
      }
    } catch (error) {
      this.logger.warn(`Keep-alive falhou: ${(error as Error).message}`);
    }
  }
}
