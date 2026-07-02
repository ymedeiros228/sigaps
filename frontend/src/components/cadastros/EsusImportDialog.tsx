import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { Upload } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { integrationsApi } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

type EsusImportDialogProps = {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export function EsusImportDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
}: EsusImportDialogProps) {
  const [csv, setCsv] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: () => integrationsApi.importEsus(municipalityId, csv),
    onSuccess: (res) => {
      const { updated, total, errors } = res.data;
      setResult(
        `Importação concluída: ${updated} de ${total} linha(s) atualizadas` +
          (errors.length > 0 ? ` · ${errors.length} erro(s)` : ''),
      );
      onSuccess?.();
    },
    onError: (err) => setResult(getApiErrorMessage(err, 'Não foi possível importar a planilha.')),
  });

  const previewLines = useMemo(() => csv.split(/\r?\n/).filter(Boolean).length, [csv]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Importar piloto e-SUS (CSV)</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aceita colunas como <code>no_logradouro</code>, <code>qt_familia</code>,{' '}
          <code>nu_moradores</code> ou o formato simples <code>rua;familias;habitantes</code>.
          As ruas devem já existir no SIGAPS.
        </Typography>
        <TextField
          label="Cole o CSV exportado"
          multiline
          minRows={8}
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={'no_logradouro;qt_familia;nu_moradores\nRua A;12;45'}
          fullWidth
        />
        {previewLines > 1 && (
          <Typography variant="caption" color="text.secondary">
            {previewLines - 1} linha(s) detectada(s)
          </Typography>
        )}
        {result && <Alert severity={importMutation.isSuccess ? 'success' : 'error'}>{result}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        <Button
          variant="contained"
          startIcon={<Upload />}
          disabled={!csv.trim() || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          {importMutation.isPending ? 'Importando…' : 'Importar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
