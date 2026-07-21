import { ApiProperty } from '@nestjs/swagger';
import { EntityStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';

export class BulkAcsItemDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  name: string;

  @ApiProperty({
    example: '12345678901',
    required: false,
    description:
      'Opcional na importação em lote; se ausente, o sistema gera código interno',
  })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  cpf?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    required: false,
    description: 'Nome ou número da microárea (ex: 01)',
  })
  @IsOptional()
  @IsString()
  microareaRef?: string;

  @ApiProperty({
    required: false,
    description: 'Lista de ruas/trechos atendidos pelo ACS',
    example: 'Rua do Sol; Travessa da Paz; Avenida Central',
  })
  @IsOptional()
  @IsString()
  streetCoverageText?: string;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}

export class BulkAcsImportDto {
  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ type: [BulkAcsItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkAcsItemDto)
  items: BulkAcsItemDto[];
}
