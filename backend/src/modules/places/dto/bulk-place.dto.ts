import { ApiProperty } from '@nestjs/swagger';
import { PlaceKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkPlaceItemDto {
  @ApiProperty({ example: 'Povoado Bacabinha' })
  @IsString()
  name: string;

  @ApiProperty({ example: -6.215 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -43.81 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ enum: PlaceKind, required: false })
  @IsOptional()
  @IsEnum(PlaceKind)
  kind?: PlaceKind;

  @ApiProperty({ required: false, description: 'Nome da UBS de referência' })
  @IsOptional()
  @IsString()
  ubsRef?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkPlaceImportDto {
  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ type: [BulkPlaceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPlaceItemDto)
  items: BulkPlaceItemDto[];
}
