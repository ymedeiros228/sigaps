import { ApiProperty, PartialType } from '@nestjs/swagger';
import { EntityStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

function emptyToNull({ value }: { value: unknown }) {
  if (value === '' || value === undefined) return null;
  return value;
}

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
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  ubsId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  acsId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  neighborhoodId?: string | null;

  @ApiProperty({ enum: EntityStatus, required: false })
  @IsOptional()
  @IsEnum(EntityStatus)
  status?: EntityStatus;
}

export class UpdateMicroareaDto extends PartialType(CreateMicroareaDto) {}
