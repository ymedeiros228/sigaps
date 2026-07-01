import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { Prisma } from '@prisma/client';

export interface AuditEntry {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: Prisma.InputJsonValue;
  afterData?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        beforeData: entry.beforeData ?? undefined,
        afterData: entry.afterData ?? undefined,
      },
    });
  }

  async findRecent(municipalityId?: string, limit = 20) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      where: municipalityId
        ? { user: { municipalityId } }
        : undefined,
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    });
  }
}
