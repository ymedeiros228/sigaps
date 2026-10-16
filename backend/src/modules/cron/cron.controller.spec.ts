import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BackupSchedulerService } from '../admin/backup-scheduler.service';
import { EsusSchedulerService } from '../integrations/esus-scheduler.service';
import { CronController } from './cron.controller';

function makeController(secret?: string) {
  const backups = { runWeeklyBackups: jest.fn() };
  const esus = { runWeeklyEsusSync: jest.fn() };
  const controller = new CronController(
    { get: () => secret } as unknown as ConfigService,
    backups as unknown as BackupSchedulerService,
    esus as unknown as EsusSchedulerService,
  );
  return { controller, backups, esus };
}

describe('CronController', () => {
  it('roda o backup com o segredo correto', async () => {
    const { controller, backups } = makeController('s3cret');
    await expect(controller.backup('Bearer s3cret')).resolves.toEqual({
      ok: true,
    });
    expect(backups.runWeeklyBackups).toHaveBeenCalled();
  });

  it('recusa segredo errado ou ausente', async () => {
    const { controller, esus } = makeController('s3cret');
    await expect(controller.esusSync('Bearer outro')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(controller.esusSync(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(esus.runWeeklyEsusSync).not.toHaveBeenCalled();
  });

  it('fica indisponível sem CRON_SECRET configurado', async () => {
    const { controller } = makeController(undefined);
    await expect(controller.backup('Bearer ')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
