import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EntityStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateAcsDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  name: string;

  @ApiProperty({
    example: '12345678901',
    required: false,
    description: 'Opcional no cadastro manual — código interno é gerado automaticamente',
  })
  @IsOptional()
  @IsString()
  @Length(11, 11)
  cpf?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiProperty({
    required: false,
    description: 'Lista livre de ruas/trechos atendidos pelo ACS',
    example: 'Rua do Sol; Travessa da Paz; Avenida Central',
  })
  @IsOptional()
  @IsString()
  streetCoverageText?: string;

  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ required: false, description: 'Vincular ACS à microárea' })
  @IsOptional()
  @IsUUID()
  microareaId?: string;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}

export class UpdateAcsDto extends PartialType(CreateAcsDto) {}
