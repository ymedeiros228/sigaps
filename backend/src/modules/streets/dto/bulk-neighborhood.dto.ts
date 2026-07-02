import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, IsUUID, MinLength, ValidateNested } from 'class-validator';

export class BulkNeighborhoodItemDto {
  @ApiProperty({ example: 'Rua Coronel Manoel Bandeira' })
  @IsString()
  @MinLength(1)
  streetRef: string;

  @ApiProperty({ example: 'Centro' })
  @IsString()
  @MinLength(1)
  neighborhoodRef: string;
}

export class BulkNeighborhoodDto {
  @ApiProperty()
  @IsUUID()
  municipalityId: string;

  @ApiProperty({ type: [BulkNeighborhoodItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkNeighborhoodItemDto)
  items: BulkNeighborhoodItemDto[];
}
