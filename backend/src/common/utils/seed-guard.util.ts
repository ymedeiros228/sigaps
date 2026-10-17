/** Ref do projeto Supabase de produção (aparece no usuário do pooler e no host direto). */
const PRODUCTION_DB_REFS = ['hyqzofrsuqhewoceaals'];

export type SeedPlan = {
  /** Zera a pintura do mapa e apaga ruas sem OSM (só com SEED_RESET_MAP=true). */
  resetMap: boolean;
};

/**
 * Decide o que o seed pode fazer neste banco.
 * Lança erro no banco de produção, salvo com SEED_ALLOW_PRODUCTION=true.
 */
export function planSeed(
  databaseUrl: string | undefined,
  env: Record<string, string | undefined>,
): SeedPlan {
  const isProduction = PRODUCTION_DB_REFS.some((ref) =>
    (databaseUrl ?? '').includes(ref),
  );
  if (isProduction && env.SEED_ALLOW_PRODUCTION !== 'true') {
    throw new Error(
      'Seed bloqueado: DATABASE_URL aponta para o banco de produção. ' +
        'O seed é só para banco local ou de teste (use SEED_ALLOW_PRODUCTION=true se for mesmo intencional).',
    );
  }
  return { resetMap: env.SEED_RESET_MAP === 'true' };
}
