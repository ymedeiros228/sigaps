import { UserRole } from '@prisma/client';

const MASK_ROLES: UserRole[] = [UserRole.ENFERMEIRO, UserRole.ACS];

export function shouldMaskCpf(role?: string): boolean {
  if (!role) return false;
  return MASK_ROLES.includes(role as UserRole);
}

export function maskCpfValue(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length < 11) return cpf;
  return `***.***.***-${d.slice(-2)}`;
}

export function maskCpfField(cpf: string | null | undefined, role?: string): string | null | undefined {
  if (cpf == null) return cpf;
  return shouldMaskCpf(role) ? maskCpfValue(cpf) : cpf;
}
