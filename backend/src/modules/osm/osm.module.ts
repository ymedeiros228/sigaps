import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { OsmController } from './osm.controller';
import { OsmImportService } from './osm-import.service';

@Module({
  imports: [PlacesModule],
  controllers: [OsmController],
  providers: [OsmImportService],
  exports: [OsmImportService],
})
export class OsmModule {}
