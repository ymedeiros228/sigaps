import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { StreetsController } from './streets.controller';
import { StreetsService } from './streets.service';

@Module({
  controllers: [StreetsController],
  providers: [StreetsService, AuditService],
  exports: [StreetsService],
})
export class StreetsModule {}
