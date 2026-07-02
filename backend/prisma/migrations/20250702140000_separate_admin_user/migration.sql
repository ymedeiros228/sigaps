-- Jonas permanece enfermeiro; conta separada para administração do sistema
UPDATE users SET role = 'ENFERMEIRO' WHERE email = 'jonas@passagemfranca.ma.gov.br';

INSERT INTO users (id, email, password_hash, name, role, municipality_id, is_active, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'admin@passagemfranca.ma.gov.br',
  u.password_hash,
  'Administrador SIGAPS',
  'ADMINISTRADOR',
  u.municipality_id,
  true,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'jonas@passagemfranca.ma.gov.br'
ON CONFLICT (email) DO UPDATE SET
  role = 'ADMINISTRADOR',
  name = 'Administrador SIGAPS',
  municipality_id = EXCLUDED.municipality_id,
  updated_at = NOW();
