-- Usuário ACS de demonstração vinculado ao agente Ana Paula Santos (Microárea 01)
INSERT INTO users (id, email, password_hash, name, role, municipality_id, is_active, created_at, updated_at)
SELECT
  'a1b2c3d4-e5f6-4789-a012-3456789abcde',
  'acs@passagemfranca.ma.gov.br',
  u.password_hash,
  'Ana Paula Santos',
  'ACS',
  u.municipality_id,
  true,
  NOW(),
  NOW()
FROM users u
WHERE u.email = 'admin@passagemfranca.ma.gov.br'
ON CONFLICT (email) DO UPDATE SET
  role = 'ACS',
  name = 'Ana Paula Santos',
  password_hash = EXCLUDED.password_hash,
  updated_at = NOW();

UPDATE acs
SET user_id = (SELECT id FROM users WHERE email = 'acs@passagemfranca.ma.gov.br')
WHERE cpf = '11122233344';
