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

export function formatAuditAction(action: string, entityType: string): string {
  const actions: Record<string, string> = {
    ASSIGN_MICROAREA: 'Vinculou rua à microárea',
    CREATE: 'Cadastrou',
    UPDATE: 'Atualizou',
    DELETE: 'Removeu',
  };
  const entities: Record<string, string> = {
    street: 'rua',
    microarea: 'microárea',
    ubs: 'UBS',
    acs: 'ACS',
    neighborhood: 'bairro',
    municipality: 'município',
  };
  const verb = actions[action] ?? action.replace(/_/g, ' ').toLowerCase();
  const entity = entities[entityType] ?? entityType;
  return `${verb} ${entity}`;
}
