import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateUbsDto {
  @ApiProperty({ example: 'UBS Centro' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Rua Principal, 100' })
  @IsString()
  address: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  coordinator?: string;

  @ApiProperty({ example: -6.1828 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -43.7869 })
  @IsNumber()
  longitude: number;

  @ApiProperty()
  @IsUUID()
  municipalityId: string;
}

export class UpdateUbsDto extends PartialType(CreateUbsDto) {}
