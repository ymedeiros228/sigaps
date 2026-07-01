import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AssignStreetsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  streetIds: string[];

  @ApiProperty()
  @IsUUID()
  microareaId: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  forceTransfer?: boolean;
}
