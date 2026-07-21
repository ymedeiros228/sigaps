import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PaintCircleDto {
  @ApiPropertyOptional({ example: 'Mapa Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;
  @ApiProperty()
  @IsUUID()
  microareaId: string;

  @ApiProperty({ example: -6.1828 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat: number;

  @ApiProperty({ example: -43.7869 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLng: number;

  @ApiProperty({ description: 'Raio em metros', example: 500 })
  @IsNumber()
  @Min(100)
  @Max(5000)
  radiusMeters: number;
}
