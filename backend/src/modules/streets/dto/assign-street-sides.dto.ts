import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignStreetSidesDto {
  @ApiProperty({ enum: ['FULL', 'SPLIT'] })
  @IsIn(['FULL', 'SPLIT'])
  mode!: 'FULL' | 'SPLIT';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  microareaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  leftMicroareaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  rightMicroareaId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  leftSideNotes?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  rightSideNotes?: string;
}
