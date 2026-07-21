import { ApiProperty, PartialType } from '@nestjs/swagger';
import { PlaceKind } from '@prisma/client';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreatePlaceDto {
  @ApiProperty({ example: 'Povoado Bacabinha' })
  @IsString()
  name: string;

  @ApiProperty({ enum: PlaceKind, required: false })
  @IsOptional()
  @IsEnum(PlaceKind)
  kind?: PlaceKind;

  @ApiProperty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePlaceDto extends PartialType(CreatePlaceDto) {}

export class NominatimSearchDto {
  @ApiProperty()
  @IsString()
  q: string;

  @ApiProperty()
  @IsUUID()
  municipalityId: string;
}
