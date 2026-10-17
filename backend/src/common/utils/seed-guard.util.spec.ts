import { planSeed } from './seed-guard.util';

describe('planSeed', () => {
  const PROD_POOLER =
    'postgresql://postgres.hyqzofrsuqhewoceaals:senha@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true';
  const PROD_DIRECT =
    'postgresql://postgres:senha@db.hyqzofrsuqhewoceaals.supabase.co:5432/postgres';
  const CI_LOCAL =
    'postgresql://sigaps:sigaps_secret@127.0.0.1:5432/sigaps?schema=public';
  const DEV_POOLER =
    'postgresql://postgres.jjbyttlllwrjijiguwex:senha@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

  it.each([
    ['pooler', PROD_POOLER],
    ['conexão direta', PROD_DIRECT],
  ])('recusa o banco de produção (%s)', (_tipo, url) => {
    expect(() => planSeed(url, {})).toThrow(/produção/);
  });

  it.each([
    ['Postgres local do CI', CI_LOCAL],
    ['sigaps-dev', DEV_POOLER],
  ])('libera %s sem zerar o mapa', (_nome, url) => {
    expect(planSeed(url, {})).toEqual({ resetMap: false });
  });

  it('só zera o mapa com SEED_RESET_MAP=true', () => {
    expect(planSeed(CI_LOCAL, { SEED_RESET_MAP: 'true' })).toEqual({
      resetMap: true,
    });
    expect(planSeed(CI_LOCAL, { SEED_RESET_MAP: '1' })).toEqual({
      resetMap: false,
    });
  });

  it('libera a produção só com SEED_ALLOW_PRODUCTION=true', () => {
    expect(planSeed(PROD_POOLER, { SEED_ALLOW_PRODUCTION: 'true' })).toEqual({
      resetMap: false,
    });
    expect(() =>
      planSeed(PROD_POOLER, { SEED_ALLOW_PRODUCTION: 'sim' }),
    ).toThrow(/produção/);
  });
});
