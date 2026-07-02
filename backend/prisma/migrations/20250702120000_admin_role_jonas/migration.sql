-- Promove usuário principal a administrador do sistema
UPDATE users SET role = 'ADMINISTRADOR' WHERE email = 'jonas@passagemfranca.ma.gov.br';
