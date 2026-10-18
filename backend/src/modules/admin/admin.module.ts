import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupService } from './backup.service';
import { TeamController } from './team.controller';

@Module({
  imports: [AuditModule],
  controllers: [AdminController, TeamController],
  providers: [AdminService, BackupService, BackupSchedulerService],
  exports: [BackupSchedulerService],
})
export class AdminModule {}
