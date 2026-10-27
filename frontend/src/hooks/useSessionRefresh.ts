import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '../services/api';
import { useAuthStore } from '../store';

/**
 * Relê a conta da sessão ao abrir o app (e ao voltar para a aba): quem ganhou ou perdeu a
 * função de administrador vê o menu certo sem precisar sair e entrar de novo.
 */
export function useSessionRefresh() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const { data } = useQuery({
    queryKey: ['auth', 'me', user?.id],
    queryFn: () => authApi.me().then((r) => r.data),
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!data || !user || data.id !== user.id) return;
    const changed =
      data.role !== user.role || !!data.isAdmin !== !!user.isAdmin || data.name !== user.name;
    if (changed) setUser({ ...user, ...data });
  }, [data, user, setUser]);
}
