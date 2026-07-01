import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateNeighborhoodDto {
  @ApiProperty({ example: 'Centro' })
  @IsString()
  name: string;

  @ApiProperty()
  @IsUUID()
  municipalityId: string;
}

export class UpdateNeighborhoodDto extends PartialType(CreateNeighborhoodDto) {}
