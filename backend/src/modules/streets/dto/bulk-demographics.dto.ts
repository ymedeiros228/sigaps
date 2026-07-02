import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, MinLength, ValidateNested } from 'class-validator';

export class BulkDemographicsItemDto {
  @ApiProperty({ example: 'Rua Coronel Manoel Bandeira' })
  @IsString()
  @MinLength(1)
  streetRef: string;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(0)
  familyCount: number;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(0)
  inhabitantCount: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsInt()
  @Min(0)
  propertyCount?: number;
}

export class BulkDemographicsDto {
  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ type: [BulkDemographicsItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkDemographicsItemDto)
  items: BulkDemographicsItemDto[];
}
