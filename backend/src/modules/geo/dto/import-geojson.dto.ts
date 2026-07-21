import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class ImportGeoJsonDto {
  @ApiProperty({
    description: 'GeoJSON Feature ou FeatureCollection com LineStrings',
  })
  @IsObject()
  geojson: GeoJSON.Feature | GeoJSON.FeatureCollection;

  @ApiProperty({
    required: false,
    description: 'Atualizar ruas existentes pelo mesmo nome',
  })
  @IsOptional()
  @IsBoolean()
  updateByName?: boolean;
}
