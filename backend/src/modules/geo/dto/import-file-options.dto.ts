import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class ImportFileOptionsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  updateByName?: boolean;
}
