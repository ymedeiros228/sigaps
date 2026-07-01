import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from '../../common/services/audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
