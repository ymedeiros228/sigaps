import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EsusService } from './esus.service';

@Injectable()
export class EsusSchedulerService {
  private readonly logger = new Logger(EsusSchedulerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly esus: EsusService,
  ) {}

  /** Segunda-feira às 04:00 — reaplica último CSV e-SUS salvo por município. */
  @Cron('0 4 * * 1')
  async runWeeklyEsusSync() {
    if (this.config.get<string>('AUTO_ESUS_SYNC_ENABLED') !== 'true') return;

    const municipalities = await this.prisma.municipality.findMany({
      where: { esusImportCsv: { not: null } },
      select: { id: true, name: true },
    });

    for (const municipality of municipalities) {
      try {
        const actor = await this.prisma.user.findFirst({
          where: {
            municipalityId: municipality.id,
            role: 'ADMINISTRADOR',
            isActive: true,
          },
          select: { id: true },
        });
        if (!actor) {
          this.logger.warn(`e-SUS sync ignorado (${municipality.name}): sem admin ativo`);
          continue;
        }

        const result = await this.esus.syncLast(municipality.id, actor.id);
        this.logger.log(
          `e-SUS sync automático: ${municipality.name} — ${result.updated}/${result.total} ruas`,
        );
      } catch (error) {
        this.logger.error(`Falha no e-SUS sync de ${municipality.name}`, error);
      }
    }
  }
}
