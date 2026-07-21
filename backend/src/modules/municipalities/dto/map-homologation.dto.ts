import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class MapHomologationDto {
  @ApiProperty({ description: 'true = homologar, false = revogar homologação' })
  @IsBoolean()
  homologated: boolean;

  @ApiProperty({
    required: false,
    example: 'Aprovado na reunião da SMS em 04/07/2026',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
