import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Link,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import {
  CheckCircle,
  Description,
  OpenInNew,
  PictureAsPdf,
  RadioButtonUnchecked,
  Undo,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { municipalitiesApi, dashboardApi, type Municipality } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { downloadHomologationCertificate } from '../../utils/homologationCertificatePdf';
import { queryKeys } from '../../utils/queryKeys';

type AdminHomologationTabProps = {
  municipalityId: string;
};

export function AdminHomologationTab({ municipalityId }: AdminHomologationTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [certLoading, setCertLoading] = useState(false);

  const { data: municipality, isLoading } = useQuery({
    queryKey: ['municipality', municipalityId],
    queryFn: () => municipalitiesApi.get(municipalityId).then((r) => r.data),
  });

  const { data: checklist } = useQuery({
    queryKey: queryKeys.operationalChecklist(municipalityId),
    queryFn: () => dashboardApi.checklist(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
  });

  const homologateMutation = useMutation({
    mutationFn: (payload: { homologated: boolean; notes?: string }) =>
      municipalitiesApi.setMapHomologation(municipalityId, payload).then((r) => r.data),
    onSuccess: (data: Municipality) => {
      queryClient.setQueryData(['municipality', municipalityId], data);
      queryClient.invalidateQueries({ queryKey: queryKeys.operationalChecklist(municipalityId) });
      setDialogOpen(false);
      setNotes('');
      setMessage(
        data.mapHomologatedAt
          ? 'Mapa homologado pela SMS. O carimbo aparecerá nos próximos PDFs gerados.'
          : 'Homologação revogada.',
      );
    },
    onError: (err) => setMessage(getApiErrorMessage(err, 'Não foi possível atualizar a homologação.')),
  });

  const handleDownloadCertificate = async () => {
    if (!municipality?.mapHomologatedAt || !municipality.mapHomologatedBy || !checklist) return;
    setCertLoading(true);
    try {
      await downloadHomologationCertificate({
        municipality: {
          name: municipality.name,
          state: municipality.state,
          prefecture: municipality.prefecture,
          secretariat: municipality.secretariat,
          logoUrl: municipality.logoUrl,
        },
        homologation: {
          at: municipality.mapHomologatedAt,
          by: municipality.mapHomologatedBy,
          notes: municipality.mapHomologationNotes,
        },
        checklist,
      });
    } finally {
      setCertLoading(false);
    }
  };

  if (isLoading || !municipality) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  const homologated = !!municipality.mapHomologatedAt;
  const ready = checklist?.readyForHomologation ?? false;
  const pendingItems =
    checklist?.items.filter(
      (item) => !item.done && (item.priority === 'critical' || item.id === 'coverage'),
    ) ?? [];
  const activeStep = homologated ? 3 : ready ? 1 : 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="admin-homologation-tab">
      {message && (
        <Alert severity={homologated ? 'success' : 'info'} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Guia de homologação (G2 / A6)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
            Siga os passos abaixo para levar o mapa oficial à SMS e registrar o aceite formal no
            sistema.
          </Typography>

          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
            <Step completed={ready || homologated}>
              <StepLabel>Checklist OK</StepLabel>
            </Step>
            <Step completed={homologated}>
              <StepLabel>Revisar PDF A3</StepLabel>
            </Step>
            <Step completed={homologated}>
              <StepLabel>Registrar SMS</StepLabel>
            </Step>
          </Stepper>

          {checklist && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress
                variant="determinate"
                value={checklist.progressPct}
                sx={{ mb: 1, height: 8, borderRadius: 4 }}
              />
              <Typography variant="body2" color="text.secondary">
                {checklist.completed}/{checklist.total} itens do checklist ·{' '}
                {ready ? 'critérios mínimos atendidos' : 'conclua itens críticos e cobertura ≥80%'}
              </Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: ready ? 'success.light' : 'warning.light',
                bgcolor: ready ? 'success.50' : 'warning.50',
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Passo 1 — Verificar checklist
              </Typography>
              {pendingItems.length === 0 ? (
                <Typography variant="body2" color="success.dark" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <CheckCircle fontSize="small" /> Pronto para revisão do mapa.
                </Typography>
              ) : (
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {pendingItems.map((item) => (
                    <Typography component="li" variant="body2" key={item.id} sx={{ mb: 0.5 }}>
                      {item.actionHref ? (
                        <Link component={RouterLink} to={item.actionHref} underline="hover">
                          {item.label}
                        </Link>
                      ) : (
                        item.label
                      )}
                      {' — '}
                      {item.detail}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Passo 2 — Revisar e imprimir PDF A3
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Gere o mapa oficial, imprima em A3 e leve à reunião da SMS para validação visual.
              </Typography>
              <Button
                component={RouterLink}
                to="/mapa?pdf=1&homolog=1"
                variant="contained"
                startIcon={<PictureAsPdf />}
                endIcon={<OpenInNew />}
                data-testid="homolog-open-pdf"
              >
                Abrir mapa e gerar PDF A3
              </Button>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Passo 3 — Registrar aceite da SMS
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Após a aprovação em reunião, registre a homologação para carimbar os próximos PDFs.
              </Typography>
              {!homologated ? (
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircle />}
                  onClick={() => setDialogOpen(true)}
                  data-testid="homolog-register-btn"
                >
                  Registrar homologação SMS
                </Button>
              ) : (
                <Chip icon={<CheckCircle />} label="Homologado" color="success" />
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
                Status atual
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {homologated
                  ? 'O mapa está homologado. PDFs incluem carimbo HOMOLOGADO SMS/APS.'
                  : 'Aguardando registro formal do aceite da secretaria.'}
              </Typography>
            </Box>
            <Chip
              icon={homologated ? <CheckCircle /> : <RadioButtonUnchecked />}
              label={homologated ? 'Homologado' : 'Pendente'}
              color={homologated ? 'success' : 'warning'}
              variant={homologated ? 'filled' : 'outlined'}
            />
          </Box>

          {homologated && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>Data:</strong>{' '}
                {new Date(municipality.mapHomologatedAt!).toLocaleString('pt-BR')}
              </Typography>
              <Typography variant="body2">
                <strong>Responsável:</strong> {municipality.mapHomologatedBy}
              </Typography>
              {municipality.mapHomologationNotes && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <strong>Observações:</strong> {municipality.mapHomologationNotes}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Description />}
                  onClick={() => void handleDownloadCertificate()}
                  disabled={certLoading || !checklist}
                >
                  {certLoading ? 'Gerando…' : 'Termo de homologação (PDF)'}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  startIcon={<Undo />}
                  onClick={() => homologateMutation.mutate({ homologated: false })}
                  disabled={homologateMutation.isPending}
                >
                  Revogar
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirmar homologação do mapa</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {!ready && (
            <Alert severity="warning">
              O checklist ainda não atende todos os critérios mínimos (itens críticos + cobertura
              ≥80%). Você pode homologar mesmo assim se a SMS já aprovou em reunião.
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary">
            Esta ação registra que a SMS aprovou o mapa de microáreas de{' '}
            <strong>{municipality.name}</strong>. O carimbo será incluído automaticamente nos PDFs.
          </Typography>
          <TextField
            label="Observações (opcional)"
            multiline
            minRows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: Aprovado na reunião de planejamento APS de 04/07/2026"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => homologateMutation.mutate({ homologated: true, notes: notes.trim() || undefined })}
            disabled={homologateMutation.isPending}
          >
            {homologateMutation.isPending ? 'Salvando…' : 'Confirmar homologação'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
