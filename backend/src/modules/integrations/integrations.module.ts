import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CnesService } from './cnes.service';
import { EsusService } from './esus.service';
import { IntegrationsController } from './integrations.controller';

@Module({
  imports: [AuditModule],
  controllers: [IntegrationsController],
  providers: [CnesService, EsusService],
  exports: [CnesService],
})
export class IntegrationsModule {}
