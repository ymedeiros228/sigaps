import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type AuthViewer = { id: string; role: string };

export function isAcsRole(role?: string): boolean {
  return role === UserRole.ACS;
}

export async function resolveAcsMicroareaId(
  prisma: PrismaService,
  userId: string,
): Promise<string | null> {
  const acs = await prisma.acs.findFirst({
    where: { userId, status: 'ATIVO' },
    select: { microarea: { select: { id: true } } },
  });
  return acs?.microarea?.id ?? null;
}

export async function applyAcsMicroareaScope(
  prisma: PrismaService,
  viewer: AuthViewer | undefined,
  requestedMicroareaId?: string,
): Promise<string | undefined> {
  if (!viewer || !isAcsRole(viewer.role)) return requestedMicroareaId;
  const scoped = await resolveAcsMicroareaId(prisma, viewer.id);
  return scoped ?? '__none__';
}
