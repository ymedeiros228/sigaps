import { authApi, type User } from '../services/api';
import { waitForApiReady } from '../utils/waitForApi';

/** Credenciais padrão do seed — admin em desenvolvimento local */
export const DEV_LOGIN = {
  email: 'admin@passagemfranca.ma.gov.br',
  password: 'Sigaps@2026',
};

const LEGACY_DEV_EMAIL = 'jonas@passagemfranca.ma.gov.br';

export function getDevLoginDefaults() {
  if (!import.meta.env.DEV) {
    return { email: '', password: '' };
  }
  const storedEmail = localStorage.getItem('sigaps_dev_email');
  const email =
    storedEmail && storedEmail !== LEGACY_DEV_EMAIL ? storedEmail : DEV_LOGIN.email;
  return {
    email,
    password: localStorage.getItem('sigaps_dev_password') ?? DEV_LOGIN.password,
  };
}

export function isDevAutoLoginEnabled() {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_AUTO_LOGIN !== 'false';
}

type AuthSnapshot = { user: User | null; token: string | null };
type SetAuth = (user: User, token: string, refreshToken: string) => void;

let devAdminAuthPromise: Promise<boolean> | null = null;

/** Em dev, garante sessão como administrador (auto-login ou troca de perfil demo). */
export function ensureDevAdminAuth(
  getState: () => AuthSnapshot,
  setAuth: SetAuth,
  logout: () => void,
): Promise<boolean> {
  if (!isDevAutoLoginEnabled()) return Promise.resolve(false);

  if (!devAdminAuthPromise) {
    devAdminAuthPromise = (async () => {
      const { user, token } = getState();
      if (token && user?.role === 'ADMINISTRADOR') return true;

      if (token && user?.role !== 'ADMINISTRADOR') {
        logout();
      }

      try {
        await waitForApiReady(8, 3000);
        const res = await authApi.login(DEV_LOGIN.email, DEV_LOGIN.password);
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        localStorage.setItem('sigaps_dev_email', DEV_LOGIN.email);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      devAdminAuthPromise = null;
    });
  }

  return devAdminAuthPromise;
}
