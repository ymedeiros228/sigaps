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

  async findPaginated(
    municipalityId: string,
    page = 1,
    limit = 50,
    filters?: {
      entityType?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.AuditLogWhereInput = { user: { municipalityId } };
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.action) where.action = filters.action;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, role: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page: safePage,
      limit: safeLimit,
      pages: Math.ceil(total / safeLimit),
    };
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

  async findForExport(
    municipalityId: string,
    filters?: {
      entityType?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
    },
    limit = 5000,
  ) {
    const where: Prisma.AuditLogWhereInput = { user: { municipalityId } };
    if (filters?.entityType) where.entityType = filters.entityType;
    if (filters?.action) where.action = filters.action;
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) {
        const end = new Date(filters.to);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    return this.prisma.auditLog.findMany({
      where,
      take: Math.min(limit, 5000),
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, role: true, email: true } },
      },
    });
  }
}
