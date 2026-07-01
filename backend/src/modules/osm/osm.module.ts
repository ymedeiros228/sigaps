import { Module } from '@nestjs/common';
import { OsmController } from './osm.controller';
import { OsmImportService } from './osm-import.service';

@Module({
  controllers: [OsmController],
  providers: [OsmImportService],
  exports: [OsmImportService],
})
export class OsmModule {}
