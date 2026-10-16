import {
  Controller,
  Get,
  Headers,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';
import { Public } from '../../common/decorators/roles.decorator';
import { BackupSchedulerService } from '../admin/backup-scheduler.service';
import { EsusSchedulerService } from '../integrations/esus-scheduler.service';

/**
 * Tarefas agendadas disparadas de fora (Vercel Cron), já que no serverless
 * o @Cron interno não roda. O Vercel envia `Authorization: Bearer <CRON_SECRET>`.
 */
@ApiExcludeController()
@SkipThrottle()
@Public()
@Controller('cron')
export class CronController {
  constructor(
    private readonly config: ConfigService,
    private readonly backups: BackupSchedulerService,
    private readonly esus: EsusSchedulerService,
  ) {}

  @Get('backup')
  async backup(@Headers('authorization') auth?: string) {
    this.assertAuthorized(auth);
    await this.backups.runWeeklyBackups();
    return { ok: true };
  }

  @Get('esus')
  async esusSync(@Headers('authorization') auth?: string) {
    this.assertAuthorized(auth);
    await this.esus.runWeeklyEsusSync();
    return { ok: true };
  }

  private assertAuthorized(auth?: string) {
    const secret = this.config.get<string>('CRON_SECRET')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException('CRON_SECRET não configurado.');
    }
    const expected = Buffer.from(`Bearer ${secret}`);
    const received = Buffer.from(auth ?? '');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException();
    }
  }
}
