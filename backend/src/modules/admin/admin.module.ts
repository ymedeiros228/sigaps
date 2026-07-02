import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupService } from './backup.service';

@Module({
  imports: [AuditModule],
  controllers: [AdminController],
  providers: [AdminService, BackupService, BackupSchedulerService],
})
export class AdminModule {}
