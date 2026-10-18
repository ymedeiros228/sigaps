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

/** `actor` pode dar o perfil `target` a alguém (ou mexer numa conta com esse perfil)? */
export function canHandleRole(actor: UserRole, target: UserRole): boolean {
  if (actor === UserRole.ADMINISTRADOR) return true;
  if (target === UserRole.ADMINISTRADOR) return false;
  if (!TEAM_MANAGER_ROLES.includes(actor)) return false;
  return ROLE_RANK[target] <= ROLE_RANK[actor];
}
