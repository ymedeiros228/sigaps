import { Module } from '@nestjs/common';
import { AuditService } from '../../common/services/audit.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, AuditService],
})
export class DashboardModule {}
