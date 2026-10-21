-- Fecha a API REST do Supabase (PostgREST) para as tabelas do schema public.
-- O backend fala com o banco pelo Prisma (DATABASE_URL, papel postgres, dono das
-- tabelas), que ignora RLS; então ligar RLS sem policies não muda nada para o app,
-- mas impede que a chave anon/authenticated leia, edite ou apague dados pela URL
-- do projeto (alertas rls_disabled_in_public e sensitive_columns_exposed).

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tableowner = current_user
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Segunda camada: anon e authenticated não têm motivo para tocar no public.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- search_path fixo nas funções do app (alerta function_search_path_mutable).
ALTER FUNCTION public.sync_street_geom() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_microarea_envelope(text) SET search_path = public, pg_temp;
