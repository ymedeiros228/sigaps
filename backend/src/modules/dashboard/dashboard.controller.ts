import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get(':municipalityId')
  @ApiOperation({ summary: 'Indicadores em tempo real' })
  getIndicators(@Param('municipalityId') municipalityId: string) {
    return this.dashboardService.getIndicators(municipalityId);
  }
}
