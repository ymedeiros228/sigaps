import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { MicroareasController } from './microareas.controller';
import { MicroareasService } from './microareas.service';

@Module({
  imports: [AuditModule],
  controllers: [MicroareasController],
  providers: [MicroareasService],
  exports: [MicroareasService],
})
export class MicroareasModule {}
