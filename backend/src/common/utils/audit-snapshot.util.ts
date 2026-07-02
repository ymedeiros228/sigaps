import { Prisma } from '@prisma/client';

/** Remove campos sensíveis antes de gravar no log de auditoria. */
export function auditSnapshot<T extends Record<string, unknown>>(
  data: T | null | undefined,
  keys?: (keyof T)[],
): Prisma.InputJsonValue | undefined {
  if (!data) return undefined;
  const source = keys
    ? Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, data[k]]))
    : { ...data };
  const safe = { ...source } as Record<string, unknown>;
  delete safe.passwordHash;
  delete safe.refreshToken;
  return safe as Prisma.InputJsonValue;
}
