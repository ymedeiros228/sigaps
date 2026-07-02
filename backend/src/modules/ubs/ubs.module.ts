import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UbsController } from './ubs.controller';
import { UbsService } from './ubs.service';

@Module({
  imports: [AuditModule],
  controllers: [UbsController],
  providers: [UbsService],
  exports: [UbsService],
})
export class UbsModule {}
