import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AcsController } from './acs.controller';
import { AcsService } from './acs.service';

@Module({
  imports: [AuditModule],
  controllers: [AcsController],
  providers: [AcsService],
  exports: [AcsService],
})
export class AcsModule {}
