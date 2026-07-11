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

  /** segment = cortar/dividir no clique; whole = rua inteira de uma vez */
  @IsOptional()
  @IsIn(['segment', 'whole'])
  scope?: 'segment' | 'whole';
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
