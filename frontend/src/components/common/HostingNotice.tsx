import { useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import { Info, ExpandMore, ExpandLess, Download } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import {
  LEGACY_DOWNLOAD_FILENAME,
  LEGACY_DOWNLOAD_PATH,
  legacyDownloadShareUrl,
} from '../../constants/delivery';

const DISMISS_KEY = 'sigaps_hosting_notice_dismissed';

function isCloudDeployment() {
  if (!import.meta.env.PROD) return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
}

export function HostingNotice() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  );

  if (!isCloudDeployment() || dismissed) return null;

  return (
    <Alert
      severity="info"
      sx={{ borderRadius: 0, py: 0.75 }}
      action={
        <Button color="inherit" size="small" onClick={() => {
          localStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}>
          Entendi
        </Button>
      }
    >
      <strong>Hospedagem gratuita.</strong> O primeiro acesso do dia pode demorar ~1 min.{' '}
      <Link component={RouterLink} to="/ajuda" color="inherit" underline="always">
        Ver limitações
      </Link>
    </Alert>
  );
}

export function AjudaHostingPage() {
  const [open, setOpen] = useState(true);

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Plano gratuito — o que saber
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        O SIGAPS está online sem custo inicial. A SMS pode migrar para plano pago ou domínio
        próprio quando fizer sentido — sem refazer o sistema.
      </Typography>

      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Limitações do dia a dia
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2.5, '& li': { mb: 1 } }}>
          <li>
            <strong>Primeiro acesso lento:</strong> após ~15 min sem uso, o servidor “acorda” em
            até 1 minuto. Depois fica rápido.
          </li>
          <li>
            <strong>Endereço web:</strong> por enquanto é um link gratuito (ex.:{' '}
            <em>*.pages.dev</em>), não um domínio <em>.gov.br</em>.
          </li>
          <li>
            <strong>Internet obrigatória:</strong> mapa satélite e ruas precisam de conexão.
          </li>
          <li>
            <strong>Espaço:</strong> ~500 MB de banco — suficiente para Passagem Franca no piloto.
          </li>
          <li>
            <strong>Em evolução:</strong> e-SUS automático (API) e domínio institucional
            ainda não estão prontos.
          </li>
        </Box>
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
        <Box
          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setOpen(!open)}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Quando migrar para plano pago?
          </Typography>
          <IconToggle open={open} />
        </Box>
        <Collapse in={open}>
          <Box component="ul" sx={{ m: 0, mt: 1.5, pl: 2.5, '& li': { mb: 1 } }}>
            <li>Uso diário pela SMS sem espera na abertura → servidor sempre ligado (~US$ 7/mês)</li>
            <li>Domínio institucional <em>.com.br</em> ou <em>.gov.br</em> → registro + DNS</li>
            <li>Muitos municípios ou backup formal → banco e API em plano superior</li>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Estimativa básica paga: US$ 10–25/mês (sem contar domínio).
          </Typography>
        </Collapse>
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Pacote ZIP para o Jonas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Código-fonte legado da entrega (backend, frontend, documentação). O Jonas pinta o mapa pelo
          site — o ZIP é para arquivo, auditoria ou outro desenvolvedor.
        </Typography>
        <Button
          variant="contained"
          color="success"
          startIcon={<Download />}
          component="a"
          href={LEGACY_DOWNLOAD_PATH}
          download={LEGACY_DOWNLOAD_FILENAME}
          sx={{ fontWeight: 700, mb: 1 }}
        >
          Baixar sigaps-legado-passagem-franca.zip
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
          Link: {legacyDownloadShareUrl()}
        </Typography>
      </Paper>

      <Alert icon={<Info />} severity="success" sx={{ borderRadius: 2 }}>
        <AlertTitle>O que já funciona bem no plano grátis</AlertTitle>
        Pintar microáreas, buscar ruas, dashboard, cadastros, PDF do mapa e trabalho em equipe
        para uma secretaria municipal.
      </Alert>
    </Box>
  );
}

function IconToggle({ open }: { open: boolean }) {
  return open ? <ExpandLess /> : <ExpandMore />;
}
