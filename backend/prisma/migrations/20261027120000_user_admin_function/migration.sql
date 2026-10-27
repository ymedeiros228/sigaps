-- Função de administrador separada do perfil: a conta continua com o perfil dela
-- (ex.: Enfermeiro) e, com a função ligada, tem o mesmo acesso do ADMINISTRADOR.
-- Só acrescenta a coluna (desligada para todos); o código antigo segue funcionando.
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;
