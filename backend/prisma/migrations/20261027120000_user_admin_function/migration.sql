-- Função de administrador separada do perfil: a conta continua com o perfil dela
-- (ex.: Enfermeiro) e, com a função ligada, tem o mesmo acesso do ADMINISTRADOR.
-- Só acrescenta a coluna (desligada para todos); o código antigo segue funcionando.
-- IF NOT EXISTS: pode ser aplicada antes pelo MCP sem quebrar o migrate deploy.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN NOT NULL DEFAULT false;
