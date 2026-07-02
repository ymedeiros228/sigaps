import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CnesService } from './cnes.service';
import { EsusSchedulerService } from './esus-scheduler.service';
import { EsusService } from './esus.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController],
  providers: [CnesService, EsusService, EsusSchedulerService],
  exports: [CnesService],
})
export class IntegrationsModule {}
