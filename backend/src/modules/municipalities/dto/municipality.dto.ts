import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Length } from 'class-validator';

export class CreateMunicipalityDto {
  @ApiProperty({ example: 'Passagem Franca' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'MA' })
  @IsString()
  @Length(2, 2)
  state: string;

  @ApiProperty({ example: 'Prefeitura Municipal de Passagem Franca' })
  @IsString()
  prefecture: string;

  @ApiProperty({ example: 'Secretaria Municipal de Saúde' })
  @IsString()
  secretariat: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ example: -6.1828 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -43.7869 })
  @IsNumber()
  longitude: number;
}
