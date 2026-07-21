import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('municipality/:municipalityId/acs-coverage')
  @ApiOperation({ summary: 'Relatório de cobertura territorial por ACS' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async getAcsCoverage(
    @Param('municipalityId') municipalityId: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.dashboardService.getAcsCoverage(municipalityId);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sigaps-cobertura-acs-${municipalityId.slice(0, 8)}.csv"`,
      );
      return this.dashboardService.buildAcsCoverageCsv(rows);
    }
    return rows;
  }

  @Get('municipality/:municipalityId/acs-coverage.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Exportar cobertura por ACS em CSV' })
  async getAcsCoverageCsv(
    @Param('municipalityId') municipalityId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = await this.dashboardService.getAcsCoverage(municipalityId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sigaps-cobertura-acs-${municipalityId.slice(0, 8)}.csv"`,
    );
    return this.dashboardService.buildAcsCoverageCsv(rows);
  }

  @Get('municipality/:municipalityId/checklist')
  @ApiOperation({ summary: 'Checklist operacional do município' })
  getChecklist(@Param('municipalityId') municipalityId: string) {
    return this.dashboardService.getOperationalChecklist(municipalityId);
  }

  @Get('municipality/:municipalityId/checklist.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Exportar checklist operacional em CSV' })
  async getChecklistCsv(
    @Param('municipalityId') municipalityId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const checklist =
      await this.dashboardService.getOperationalChecklist(municipalityId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sigaps-checklist-${municipalityId.slice(0, 8)}.csv"`,
    );
    return this.dashboardService.buildChecklistCsv(checklist);
  }

  @Get(':municipalityId')
  @ApiOperation({ summary: 'Indicadores em tempo real' })
  getIndicators(@Param('municipalityId') municipalityId: string) {
    return this.dashboardService.getIndicators(municipalityId);
  }
}
