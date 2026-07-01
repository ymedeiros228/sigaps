import { Module } from '@nestjs/common';
import { MicroareasController } from './microareas.controller';
import { MicroareasService } from './microareas.service';

@Module({
  controllers: [MicroareasController],
  providers: [MicroareasService],
  exports: [MicroareasService],
})
export class MicroareasModule {}
