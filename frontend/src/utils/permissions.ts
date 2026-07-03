const IMPORT_STREETS_ROLES = new Set([
  'ADMINISTRADOR',
  'SECRETARIO_SAUDE',
  'COORDENADOR_APS',
  'ENFERMEIRO',
]);

const MANAGE_CADASTROS_ROLES = new Set([
  'ADMINISTRADOR',
  'SECRETARIO_SAUDE',
  'COORDENADOR_APS',
]);

export function canImportStreets(role?: string): boolean {
  return !!role && IMPORT_STREETS_ROLES.has(role);
}

export function canManageCadastros(role?: string): boolean {
  return !!role && MANAGE_CADASTROS_ROLES.has(role);
}

/** Enfermeiro e coordenação podem cadastrar ACS manualmente. */
export function canManageAcs(role?: string): boolean {
  return !!role && (MANAGE_CADASTROS_ROLES.has(role) || role === 'ENFERMEIRO');
}

/** Quem cadastra pode remover (ACS, povoados, microáreas). */
export function canDeleteAcs(role?: string): boolean {
  return canManageAcs(role);
}

export function canDeleteCadastros(role?: string): boolean {
  return canManageCadastros(role);
}

export function canDeletePlaces(role?: string): boolean {
  return !!role && (MANAGE_CADASTROS_ROLES.has(role) || role === 'ENFERMEIRO');
}

export function canDeleteMicroareas(role?: string): boolean {
  return canCreateMicroarea(role);
}

export function canManagePlaces(role?: string): boolean {
  return !!role && (MANAGE_CADASTROS_ROLES.has(role) || role === 'ENFERMEIRO');
}

export function canManageCadastrosSection(role: string | undefined, section: string): boolean {
  if (section === 'acs') return canManageAcs(role);
  if (section === 'povoados') return canManagePlaces(role);
  return canManageCadastros(role);
}

export function canCreateMicroarea(role?: string): boolean {
  return !!role && (MANAGE_CADASTROS_ROLES.has(role) || role === 'ENFERMEIRO');
}

/** Apenas administrador do sistema. */
export function canAccessAdmin(role?: string): boolean {
  return role === 'ADMINISTRADOR';
}

export function isAcsUser(role?: string): boolean {
  return role === 'ACS';
}

/** Perfis que veem CPF completo na API e exportações. */
export function canViewFullCpf(role?: string): boolean {
  return (
    role === 'ADMINISTRADOR' ||
    role === 'SECRETARIO_SAUDE' ||
    role === 'COORDENADOR_APS'
  );
}

export function formatRoleLabel(role?: string): string {
  const labels: Record<string, string> = {
    ADMINISTRADOR: 'Administrador',
    SECRETARIO_SAUDE: 'Secretário de Saúde',
    COORDENADOR_APS: 'Coordenador APS',
    ENFERMEIRO: 'Enfermeiro',
    ACS: 'ACS',
  };
  return role ? (labels[role] ?? role.replace(/_/g, ' ')) : '—';
}

export function formatAuditAction(action: string, entityType: string): string {
  const actions: Record<string, string> = {
    ASSIGN_MICROAREA: 'Vinculou rua à microárea',
    ASSIGN_NEIGHBORHOOD: 'Vinculou rua ao bairro',
    UPDATE_DEMOGRAPHICS: 'Atualizou famílias/habitantes de',
    UNASSIGN_MICROAREA: 'Removeu pintura da rua',
    CLEAR_STREET_ASSIGNMENTS: 'Limpou todas as pinturas',
    CREATE: 'Cadastrou',
    UPDATE: 'Atualizou',
    DELETE: 'Removeu',
    RESET_PASSWORD: 'Redefiniu senha de',
    MAP_HOMOLOGATED: 'Homologou mapa oficial de',
    MAP_HOMOLOGATION_REVOKED: 'Revogou homologação do mapa de',
  };
  const entities: Record<string, string> = {
    street: 'rua',
    microarea: 'microárea',
    ubs: 'UBS',
    acs: 'ACS',
    neighborhood: 'bairro',
    municipality: 'município',
    user: 'usuário',
  };
  const verb = actions[action] ?? action.replace(/_/g, ' ').toLowerCase();
  const entity = entities[entityType] ?? entityType;
  return `${verb} ${entity}`;
}
