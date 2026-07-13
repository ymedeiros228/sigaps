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

  /** segment = cortar/dividir no clique; whole = rua inteira; brush = arrastar entre dois pontos */
  @IsOptional()
  @IsIn(['segment', 'whole', 'brush'])
  scope?: 'segment' | 'whole' | 'brush';

  /** Fim do traço ao arrastar (scope brush) */
  @IsOptional()
  @IsNumber()
  endLatitude?: number;

  @IsOptional()
  @IsNumber()
  endLongitude?: number;
}

export class UnpaintStreetAtPointDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsIn(['FULL', 'LEFT', 'RIGHT'])
  side?: 'FULL' | 'LEFT' | 'RIGHT';

  /** Fim do traço ao apagar arrastando */
  @IsOptional()
  @IsNumber()
  endLatitude?: number;

  @IsOptional()
  @IsNumber()
  endLongitude?: number;
}
