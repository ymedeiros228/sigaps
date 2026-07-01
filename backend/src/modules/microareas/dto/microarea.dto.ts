import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { EntityStatus } from '@prisma/client';

export class CreateMicroareaDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  number: number;

  @ApiProperty({ example: 'Microárea 01' })
  @IsString()
  name: string;

  @ApiProperty({ example: '#4CAF50' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  color: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  ubsId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  acsId?: string;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}

export class UpdateMicroareaDto extends PartialType(CreateMicroareaDto) {}
