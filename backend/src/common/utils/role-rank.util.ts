import { UserRole } from '@prisma/client';

/**
 * Hierarquia dos perfis para a gestão da equipe. Quem gerencia só cria, edita e
 * redefine senha de perfis do mesmo nível ou abaixo, e só o administrador mexe
 * em contas de administrador (sem isso, um enfermeiro poderia se promover).
 */
export const ROLE_RANK: Record<UserRole, number> = {
  [UserRole.ADMINISTRADOR]: 4,
  [UserRole.SECRETARIO_SAUDE]: 3,
  [UserRole.COORDENADOR_APS]: 2,
  [UserRole.ENFERMEIRO]: 1,
  [UserRole.ACS]: 0,
};

/** Perfis que abrem a tela Equipe (o ACS não gerencia contas). */
export const TEAM_MANAGER_ROLES: UserRole[] = [
  UserRole.ADMINISTRADOR,
  UserRole.SECRETARIO_SAUDE,
  UserRole.COORDENADOR_APS,
  UserRole.ENFERMEIRO,
];

/**
 * `actor` pode mexer numa conta que já existe (editar, desativar, redefinir senha)?
 * Só em perfil **abaixo** do seu, ou na própria conta: com "igual ou abaixo", um
 * enfermeiro redefiniria a senha de outro enfermeiro e entraria como ele.
 */
export function canManageAccount(
  actor: { id: string; role: UserRole },
  target: { id: string; role: UserRole },
): boolean {
  if (actor.role === UserRole.ADMINISTRADOR) return true;
  if (actor.id === target.id) return true;
  if (target.role === UserRole.ADMINISTRADOR) return false;
  if (!TEAM_MANAGER_ROLES.includes(actor.role)) return false;
  return ROLE_RANK[target.role] < ROLE_RANK[actor.role];
}

/** `actor` pode dar o perfil `target` a uma conta (nova ou alterada)? */
export function canHandleRole(actor: UserRole, target: UserRole): boolean {
  if (actor === UserRole.ADMINISTRADOR) return true;
  if (target === UserRole.ADMINISTRADOR) return false;
  if (!TEAM_MANAGER_ROLES.includes(actor)) return false;
  return ROLE_RANK[target] <= ROLE_RANK[actor];
}
