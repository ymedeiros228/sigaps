import { Module } from '@nestjs/common';
import { AcsModule } from '../acs/acs.module';
import { AuditModule } from '../audit/audit.module';
import { MicroareasController } from './microareas.controller';
import { MicroareasService } from './microareas.service';

@Module({
  imports: [AuditModule, AcsModule],
  controllers: [MicroareasController],
  providers: [MicroareasService],
  exports: [MicroareasService],
})
export class MicroareasModule {}
