import { Module } from '@nestjs/common';
import { UbsController } from './ubs.controller';
import { UbsService } from './ubs.service';

@Module({
  controllers: [UbsController],
  providers: [UbsService],
  exports: [UbsService],
})
export class UbsModule {}
