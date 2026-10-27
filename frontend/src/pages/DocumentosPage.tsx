import { useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import {
  Backup,
  Download,
  History,
  Image,
  Map as MapIcon,
  OpenInNew,
  PictureAsPdf,
  TableChart,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store';
import { getApiErrorMessage } from '../utils/apiError';
import {
  downloadBlob,
  downloadMicroareasGeoJson,
  downloadStreetsGeoJson,
  downloadStreetsKml,
  downloadStreetsSvg,
} from '../utils/mapFileExports';
import { accessRole, canAccessAdmin } from '../utils/permissions';

// Tudo o que o SIGAPS gera, num lugar só (pedido do Yuri em 27/10: "deve ter a aba disso").
// O PDF e as imagens precisam do mapa na tela, então o botão leva ao mapa já com o PDF aberto.

interface DocRowProps {
  icon: ReactNode;
  title: string;
  description: string;
  format: string;
  /** Baixa direto daqui. */
  onDownload?: () => Promise<void>;
  /** Ou leva para a tela onde o documento é gerado. */
  to?: string;
  actionLabel?: string;
}

function DocRow({ icon, title, description, format, onDownload, to, actionLabel }: DocRowProps) {
  const [loading, setLoading] = useState(false);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
      <Box sx={{ color: 'text.secondary', display: 'flex', flexShrink: 0 }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          <Chip label={format} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      {to ? (
        <Button component={RouterLink} to={to} variant="outlined" startIcon={<OpenInNew />} sx={{ flexShrink: 0 }}>
          {actionLabel ?? 'Abrir'}
        </Button>
      ) : (
        <Button
          variant="outlined"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Download />}
          sx={{ flexShrink: 0 }}
          onClick={async () => {
            if (!onDownload) return;
            setLoading(true);
            try {
              await onDownload();
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? 'Baixando…' : (actionLabel ?? 'Baixar')}
        </Button>
      )}
    </Box>
  );
}

function DocSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        {rows.map((row, i) => (
          <Box key={i}>
            {i > 0 && <Divider />}
            {row}
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

export function DocumentosPage() {
  const municipalityId = useMunicipalityId();
  const user = useAuthStore((s) => s.user);
  const isAdmin = canAccessAdmin(accessRole(user));
  const [error, setError] = useState<string | null>(null);

  // Cada download mostra o erro no topo em vez de falhar calado.
  const run = (download: (id: string) => Promise<void>, fallback: string) => async () => {
    if (!municipalityId) return;
    setError(null);
    try {
      await download(municipalityId);
    } catch (err) {
      setError(getApiErrorMessage(err, fallback));
    }
  };

  const downloadCsv = (request: (id: string) => Promise<{ data: Blob }>, filename: string) =>
    async (id: string) => {
      const { data } = await request(id);
      downloadBlob(data, filename);
    };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
      <PageHeader
        title="Documentos"
        subtitle="Mapa oficial para imprimir, planilhas e arquivos do mapa, tudo num lugar só"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3, borderColor: 'primary.main' }}>
        <CardContent
          sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: { xs: 'wrap', sm: 'nowrap' } }}
        >
          <PictureAsPdf color="primary" sx={{ fontSize: 44, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2">
              Mapa oficial em PDF
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Satélite com as microáreas coloridas, legenda, lista de ruas por ACS, escala, QR Code e
              campos de assinatura. Papel A4 ou A3, pronto para imprimir.
            </Typography>
          </Box>
          <Button
            component={RouterLink}
            to="/mapa?pdf=1"
            variant="contained"
            size="large"
            startIcon={<PictureAsPdf />}
            data-testid="docs-generate-pdf"
            sx={{ flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
          >
            Gerar mapa em PDF
          </Button>
        </CardContent>
      </Card>

      <DocSection title="Planilhas" subtitle="Arquivos CSV: abrem no Excel ou no Google Planilhas">
        <DocRow
          icon={<TableChart />}
          title="Cobertura por ACS"
          description="Ruas pintadas, famílias e participação de cada agente no município"
          format="CSV"
          onDownload={run(
            downloadCsv(dashboardApi.acsCoverageCsv, 'sigaps-cobertura-acs.csv'),
            'Não foi possível baixar a cobertura por ACS.',
          )}
        />
        <DocRow
          icon={<TableChart />}
          title="Checklist operacional"
          description="O que já foi feito e o que falta na implantação do município"
          format="CSV"
          onDownload={run(
            downloadCsv(dashboardApi.checklistCsv, 'sigaps-checklist.csv'),
            'Não foi possível baixar o checklist.',
          )}
        />
      </DocSection>

      <DocSection
        title="Arquivos do mapa"
        subtitle="Para abrir no QGIS, no Google Earth ou em outro sistema de mapas"
      >
        <DocRow
          icon={<Image />}
          title="Imagem do mapa"
          description="Foto do que está na tela do mapa: no mapa, botão Arquivos → Imagem PNG ou JPEG"
          format="PNG / JPEG"
          to="/mapa"
          actionLabel="Ir ao mapa"
        />
        <DocRow
          icon={<Download />}
          title="Lista de ruas"
          description="Todas as ruas com o traçado e a microárea de cada uma"
          format="GeoJSON"
          onDownload={run(downloadStreetsGeoJson, 'Não foi possível exportar as ruas.')}
        />
        <DocRow
          icon={<MapIcon />}
          title="Ruas para o Google Earth"
          description="As ruas coloridas pela microárea"
          format="KML"
          onDownload={run(downloadStreetsKml, 'Não foi possível exportar o KML.')}
        />
        <DocRow
          icon={<Image />}
          title="Desenho das ruas"
          description="Arquivo vetorial leve, bom para impressão grande"
          format="SVG"
          onDownload={run(downloadStreetsSvg, 'Não foi possível exportar o SVG.')}
        />
        <DocRow
          icon={<MapIcon />}
          title="Microáreas"
          description="As áreas de cada ACS com nome e cor"
          format="GeoJSON"
          onDownload={run(downloadMicroareasGeoJson, 'Não foi possível exportar as microáreas.')}
        />
      </DocSection>

      {isAdmin && (
        <DocSection title="Administração" subtitle="Só para quem tem a função de administrador">
          <DocRow
            icon={<Backup />}
            title="Backup completo"
            description="Cópia de segurança de bairros, UBS, ACS, microáreas, ruas e usuários (sem senhas)"
            format="JSON"
            to="/admin?tab=backup"
          />
          <DocRow
            icon={<History />}
            title="Auditoria"
            description="Quem fez o quê e quando no sistema"
            format="CSV"
            to="/admin?tab=auditoria"
          />
        </DocSection>
      )}
    </Box>
  );
}
