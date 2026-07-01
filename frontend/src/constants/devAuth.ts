/** Credenciais padrão do seed — só usadas em desenvolvimento local */
export const DEV_LOGIN = {
  email: 'jonas@passagemfranca.ma.gov.br',
  password: 'Sigaps@2026',
};

export function getDevLoginDefaults() {
  if (!import.meta.env.DEV) {
    return { email: '', password: '' };
  }
  return {
    email: localStorage.getItem('sigaps_dev_email') ?? DEV_LOGIN.email,
    password: localStorage.getItem('sigaps_dev_password') ?? DEV_LOGIN.password,
  };
}

export function isDevAutoLoginEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_AUTO_LOGIN !== 'false';
}
