import { Prisma } from '@prisma/client';

function maskCpf(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return '***';
  return `***.***.***-${digits.slice(-2)}`;
}

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
  if ('cpf' in safe) safe.cpf = maskCpf(safe.cpf);
  return safe as Prisma.InputJsonValue;
}
