import { Module } from '@nestjs/common';
import { PaintZonesController } from './paint-zones.controller';
import { PaintZonesService } from './paint-zones.service';

@Module({
  controllers: [PaintZonesController],
  providers: [PaintZonesService],
  exports: [PaintZonesService],
})
export class PaintZonesModule {}
