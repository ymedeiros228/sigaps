import { useMemo } from 'react';
import { Alert, Box, Breadcrumbs, Card, CircularProgress, Link, Typography } from '@mui/material';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
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
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { useAuthStore } from '../store';
import { canManageCadastros } from '../utils/permissions';

function CadastrosContent({ municipalityId, section }: { municipalityId: string; section: CadastrosSectionId }) {
  switch (section) {
    case 'municipio':
      return <MunicipalityTab municipalityId={municipalityId} />;
    case 'ubs':
      return <UbsTab municipalityId={municipalityId} />;
    case 'acs':
      return <AcsTab municipalityId={municipalityId} />;
    case 'bairros':
      return <NeighborhoodsTab municipalityId={municipalityId} />;
    case 'microareas':
      return <MicroareasTab municipalityId={municipalityId} />;
    default:
      return null;
  }
}

export function CadastrosPage() {
  const municipalityId = useMunicipalityId();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageCadastros(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();

  const section = useMemo(() => {
    const param = searchParams.get('secao');
    return isCadastrosSectionId(param) ? param : 'municipio';
  }, [searchParams]);

  const activeSection = CADASTROS_SECTIONS.find((item) => item.id === section) ?? CADASTROS_SECTIONS[0];

  const handleSectionChange = (next: CadastrosSectionId) => {
    setSearchParams({ secao: next }, { replace: true });
  };

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
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

        <CadastrosOverview municipalityId={municipalityId} />

        {!canManage && (
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Você está em modo visualização. Para cadastrar ou editar, peça acesso ao coordenador da APS.
          </Alert>
        )}

        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 480 }}>
            <CadastrosNav section={section} onChange={handleSectionChange} />
            <Box sx={{ flex: 1, p: { xs: 2, sm: 3 }, minWidth: 0 }}>
              <CadastrosContent municipalityId={municipalityId} section={section} />
            </Box>
          </Box>
        </Card>
      </Box>
    </CadastrosProvider>
  );
}
