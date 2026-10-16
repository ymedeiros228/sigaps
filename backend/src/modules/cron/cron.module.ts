import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CronController } from './cron.controller';

@Module({
  imports: [AdminModule, IntegrationsModule],
  controllers: [CronController],
})
export class CronModule {}
