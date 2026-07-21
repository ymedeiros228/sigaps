import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupService } from './backup.service';

@Injectable()
export class BackupSchedulerService {
  private readonly logger = new Logger(BackupSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly backup: BackupService,
  ) {}

  /** Domingo às 03:00 (horário do servidor). */
  @Cron('0 3 * * 0')
  async runWeeklyBackups() {
    if (this.config.get<string>('AUTO_BACKUP_ENABLED') !== 'true') return;

    const configured = this.config.get<string>('AUTO_BACKUP_MUNICIPALITY_IDS');
    const municipalities = configured
      ? configured
          .split(',')
          .map((id) => ({ id: id.trim() }))
          .filter((m) => m.id)
      : await this.prisma.municipality.findMany({
          select: { id: true, name: true },
        });

    for (const m of municipalities) {
      try {
        const saved = await this.backup.saveAutoBackup(m.id);
        this.logger.log(`Backup automático: ${m.id} → ${saved.filename}`);
      } catch (error) {
        this.logger.error(`Falha no backup automático de ${m.id}`, error);
      }
    }
  }
}
