import { Module } from '@nestjs/common';
import { AcsController } from './acs.controller';
import { AcsService } from './acs.service';

@Module({
  controllers: [AcsController],
  providers: [AcsService],
  exports: [AcsService],
})
export class AcsModule {}
