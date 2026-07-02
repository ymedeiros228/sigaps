import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateIf } from 'class-validator';

function emptyToNull({ value }: { value: unknown }) {
  if (value === '' || value === undefined) return null;
  return value;
}

export class AssignNeighborhoodDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  streetIds: string[];

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  neighborhoodId?: string | null;
}
