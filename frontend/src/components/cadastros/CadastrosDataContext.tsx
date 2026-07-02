import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cadastrosApi } from '../../services/api';
import { cadastrosQueryDefaults } from '../../utils/cadastrosQuery';
import {
  hydrateCadastrosCache,
  type CadastrosBundle,
} from '../../utils/hydrateCadastrosCache';
import { queryKeys } from '../../utils/queryKeys';

type CadastrosDataContextValue = {
  bundle: CadastrosBundle | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
};

const CadastrosDataContext = createContext<CadastrosDataContextValue>({
  bundle: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: () => {},
});

export function useCadastrosData() {
  return useContext(CadastrosDataContext);
}

export function CadastrosDataProvider({
  municipalityId,
  children,
}: {
  municipalityId: string;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const { data: bundle, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.cadastrosBundle(municipalityId),
    queryFn: async () => {
      const res = await cadastrosApi.getBundle(municipalityId);
      hydrateCadastrosCache(queryClient, municipalityId, res.data);
      return res.data;
    },
    ...cadastrosQueryDefaults,
    staleTime: 5 * 60_000,
  });

  return (
    <CadastrosDataContext.Provider
      value={{
        bundle,
        isLoading: isPending && !bundle,
        isError,
        error: error as Error | null,
        refetch: () => void refetch(),
      }}
    >
      {children}
    </CadastrosDataContext.Provider>
  );
}
