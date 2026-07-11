import { IsIn, IsNumber, IsOptional, IsUUID } from 'class-validator';

export class PaintStreetAtPointDto {
  @IsUUID()
  microareaId!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsIn(['FULL', 'LEFT', 'RIGHT', 'BOTH'])
  side?: 'FULL' | 'LEFT' | 'RIGHT' | 'BOTH';
}

export class UnpaintStreetAtPointDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsIn(['FULL', 'LEFT', 'RIGHT'])
  side?: 'FULL' | 'LEFT' | 'RIGHT';
}
