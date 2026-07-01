import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateMunicipalityDto } from './municipality.dto';

export class UpdateMunicipalityDto extends PartialType(CreateMunicipalityDto) {}

export class UploadLogoResponseDto {
  @ApiProperty()
  logoUrl: string;
}
