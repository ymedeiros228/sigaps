import { useEffect, useMemo } from 'react';
import { Alert, Box, Breadcrumbs, Card, Link, Typography } from '@mui/material';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { CadastrosProvider } from '../components/cadastros/CadastrosContext';
import { CadastrosNav } from '../components/cadastros/CadastrosNav';
import { CadastrosOverview } from '../components/cadastros/CadastrosOverview';
import {
  CADASTROS_SECTIONS,
  isCadastrosSectionId,
  type CadastrosSectionId,
} from '../components/cadastros/cadastrosConfig';
import { MunicipalityTab } from '../components/cadastros/tabs/MunicipalityTab';
import { UbsTab } from '../components/cadastros/tabs/UbsTab';
import { AcsTab } from '../components/cadastros/tabs/AcsTab';
import { NeighborhoodsTab } from '../components/cadastros/tabs/NeighborhoodsTab';
import { MicroareasTab } from '../components/cadastros/tabs/MicroareasTab';
import { useMunicipalityBootstrap } from '../hooks/useMunicipalityBootstrap';
import { useAuthStore } from '../store';
import { canManageAcs, canManageCadastrosSection, isAcsUser } from '../utils/permissions';
import { prefetchCadastrosData } from '../utils/prefetchAppData';
import { CadastrosBootstrapping, CadastrosLoadError } from '../components/cadastros/CadastrosLoadError';

function defaultSectionForRole(role?: string): CadastrosSectionId {
  if (role === 'ENFERMEIRO') return 'acs';
  return 'municipio';
}

function CadastrosContent({
  municipalityId,
  section,
  acsAction,
  onAcsActionConsumed,
  onGoToMicroareas,
}: {
  municipalityId: string;
  section: CadastrosSectionId;
  acsAction: string | null;
  onAcsActionConsumed: () => void;
  onGoToMicroareas: () => void;
}) {
  switch (section) {
    case 'municipio':
      return <MunicipalityTab municipalityId={municipalityId} />;
    case 'ubs':
      return <UbsTab municipalityId={municipalityId} />;
    case 'acs':
      return (
        <AcsTab
          municipalityId={municipalityId}
          pendingAction={acsAction}
          onActionConsumed={onAcsActionConsumed}
          onGoToMicroareas={onGoToMicroareas}
        />
      );
    case 'bairros':
      return <NeighborhoodsTab municipalityId={municipalityId} />;
    case 'microareas':
      return <MicroareasTab municipalityId={municipalityId} />;
    default:
      return null;
  }
}

export function CadastrosPage() {
  const { municipalityId, isLoading: bootLoading, error: bootError, retry } =
    useMunicipalityBootstrap();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (municipalityId) {
      void prefetchCadastrosData(queryClient, municipalityId);
    }
  }, [municipalityId, queryClient]);

  useEffect(() => {
    const param = searchParams.get('secao');
    if (!param && user?.role === 'ENFERMEIRO') {
      setSearchParams({ secao: 'acs' }, { replace: true });
    }
  }, [user?.role, searchParams, setSearchParams]);

  const section = useMemo(() => {
    const param = searchParams.get('secao');
    return isCadastrosSectionId(param) ? param : defaultSectionForRole(user?.role);
  }, [searchParams, user?.role]);

  const acsAction = searchParams.get('acao');
  const canManageCurrentSection = canManageCadastrosSection(user?.role, section);
  const enfermeiroCanManageAcs = canManageAcs(user?.role);

  const activeSection = CADASTROS_SECTIONS.find((item) => item.id === section) ?? CADASTROS_SECTIONS[0];

  const handleSectionChange = (next: CadastrosSectionId) => {
    const nextParams: Record<string, string> = { secao: next };
    setSearchParams(nextParams, { replace: true });
  };

  const handleAcsAction = (action: 'new' | 'import') => {
    setSearchParams(
      { secao: 'acs', acao: action === 'new' ? 'novo' : 'importar' },
      { replace: true },
    );
  };

  const clearAcsAction = () => {
    if (!acsAction) return;
    const next = new URLSearchParams(searchParams);
    next.delete('acao');
    setSearchParams(next, { replace: true });
  };

  if (bootLoading && !municipalityId) {
    return (
      <CadastrosBootstrapping hint="Conectando ao servidor e carregando o município ativo…" />
    );
  }

  if (!municipalityId) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 640, mx: 'auto' }}>
        <CadastrosLoadError
          title="Não foi possível carregar o município"
          message={
            bootError?.message ??
            'Verifique sua conexão ou aguarde o servidor acordar (hospedagem gratuita).'
          }
          onRetry={retry}
        />
      </Box>
    );
  }

  if (isAcsUser(user?.role)) {
    return <Navigate to="/mapa" replace />;
  }

  return (
    <CadastrosProvider>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1280, mx: 'auto' }}>
        <Breadcrumbs sx={{ mb: 2, fontSize: '0.85rem' }}>
          <Link component={RouterLink} to="/" underline="hover" color="inherit">
            Início
          </Link>
          <Typography color="text.primary" sx={{ fontWeight: 600 }}>
            Cadastros
          </Typography>
          <Typography color="text.secondary">{activeSection.shortLabel}</Typography>
        </Breadcrumbs>

        <PageHeader
          title="Cadastros"
          subtitle="Gerencie município, UBS, ACS, bairros e microáreas da APS"
        />

        <CadastrosOverview
          municipalityId={municipalityId}
          section={section}
          onSectionChange={handleSectionChange}
          onAcsAction={handleAcsAction}
        />

        {!canManageCurrentSection && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Você está em modo visualização. Para cadastrar ou editar, peça acesso ao coordenador da APS.
          </Alert>
        )}

        {user?.role === 'ENFERMEIRO' && section !== 'acs' && enfermeiroCanManageAcs && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Como enfermeiro(a), você pode cadastrar e editar ACS na seção{' '}
            <Link
              component="button"
              variant="body2"
              onClick={() => handleSectionChange('acs')}
              sx={{ fontWeight: 700, verticalAlign: 'baseline' }}
            >
              Agentes Comunitários
            </Link>
            .
          </Alert>
        )}

        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 480 }}>
            <CadastrosNav
              section={section}
              onChange={handleSectionChange}
              highlightAcs={user?.role === 'ENFERMEIRO'}
              onSectionHover={() => prefetchCadastrosData(queryClient, municipalityId)}
            />
            <Box sx={{ flex: 1, p: { xs: 2, sm: 3 }, minWidth: 0 }}>
              <CadastrosContent
                municipalityId={municipalityId}
                section={section}
                acsAction={acsAction}
                onAcsActionConsumed={clearAcsAction}
                onGoToMicroareas={() => handleSectionChange('microareas')}
              />
            </Box>
          </Box>
        </Card>
      </Box>
    </CadastrosProvider>
  );
}
