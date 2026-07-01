import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Busca')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('municipality/:municipalityId')
  @ApiOperation({ summary: 'Busca unificada: rua, bairro, UBS, ACS, microárea' })
  search(
    @Param('municipalityId') municipalityId: string,
    @Query('q') query: string,
  ) {
    return this.searchService.search(municipalityId, query ?? '');
  }
}
