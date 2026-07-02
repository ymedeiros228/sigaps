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
  TextField,
  Typography,
} from '@mui/material';
import { CheckCircle, Description, PictureAsPdf, Undo } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { municipalitiesApi, dashboardApi, type Municipality } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';
import { downloadHomologationCertificate } from '../../utils/homologationCertificatePdf';
import { queryKeys } from '../../utils/queryKeys';

type AdminHomologationTabProps = {
  municipalityId: string;
  onOpenPdf?: () => void;
};

export function AdminHomologationTab({ municipalityId, onOpenPdf }: AdminHomologationTabProps) {
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

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {message && (
        <Alert severity={homologated ? 'success' : 'info'} onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      {checklist && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Prontidão para homologação
            </Typography>
            <LinearProgress
              variant="determinate"
              value={checklist.progressPct}
              sx={{ mb: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary">
              {checklist.completed}/{checklist.total} itens concluídos
              {checklist.readyForHomologation
                ? ' — critérios mínimos atendidos.'
                : ' — conclua itens críticos e cobertura ≥80% antes de homologar.'}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Homologação do mapa oficial (A6)
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
                Registre o aceite formal da Secretaria Municipal de Saúde após revisar o PDF A3
                impresso. O documento passará a exibir carimbo &quot;HOMOLOGADO SMS/APS&quot; e os
                campos de assinatura.
              </Typography>
            </Box>
            <Chip
              icon={homologated ? <CheckCircle /> : undefined}
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
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
            {!homologated ? (
              <Button
                variant="contained"
                startIcon={<CheckCircle />}
                onClick={() => setDialogOpen(true)}
              >
                Registrar homologação SMS
              </Button>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Description />}
                  onClick={() => void handleDownloadCertificate()}
                  disabled={certLoading || !checklist}
                >
                  {certLoading ? 'Gerando…' : 'Termo de homologação (PDF)'}
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<Undo />}
                  onClick={() => homologateMutation.mutate({ homologated: false })}
                  disabled={homologateMutation.isPending}
                >
                  Revogar homologação
                </Button>
              </>
            )}
            {onOpenPdf && (
              <Button variant="outlined" startIcon={<PictureAsPdf />} onClick={onOpenPdf}>
                Gerar PDF para revisão
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Confirmar homologação do mapa</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {!checklist?.readyForHomologation && (
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
