import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

function normalizeCnesCode(value: unknown): string | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const digits = String(value).replace(/\D/g, '');
  return digits.length > 0 ? digits.slice(0, 7) : undefined;
}

export class CreateUbsDto {
  @ApiProperty({ example: 'UBS Centro' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Rua Principal, 100', required: false })
  @IsOptional()
  @IsString()
  address?: string;

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
  @Transform(({ value }) => normalizeCnesCode(value))
  @IsString()
  @Matches(/^\d{7}$/, { message: 'CNES deve ter 7 dígitos.' })
  cnesCode?: string;

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
