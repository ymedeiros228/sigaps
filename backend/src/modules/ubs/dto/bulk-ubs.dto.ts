import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkUbsItemDto {
  @ApiProperty({ example: 'UBS Centro' })
  @IsString()
  name: string;

  @ApiProperty({ required: false, example: 'Rua Principal, 100' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: -6.1828 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: -43.7869 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coordinator?: string;

  @ApiProperty({ required: false, example: '2345678' })
  @IsOptional()
  @IsString()
  cnesCode?: string;
}

export class BulkUbsImportDto {
  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ type: [BulkUbsItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUbsItemDto)
  items: BulkUbsItemDto[];
}
