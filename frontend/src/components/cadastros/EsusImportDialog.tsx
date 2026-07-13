import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { Upload, Download } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { integrationsApi } from '../../services/api';
import { getApiErrorMessage } from '../../utils/apiError';

const CSV_TEMPLATE = `no_logradouro;qt_familia;nu_moradores
Rua Coronel Manoel Bandeira;12;45
Avenida Principal;8;28`;

type EsusImportDialogProps = {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

export function EsusImportDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
}: EsusImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState('');
  const [importErrors, setImportErrors] = useState<
    Array<{ row: number; streetRef: string; message: string }>
  >([]);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const importMutation = useMutation({
    mutationFn: () => integrationsApi.importEsus(municipalityId, csv),
    onSuccess: (res) => {
      const { updated, errors, message } = res.data;
      setImportErrors(errors);
      const ok = updated > 0;
      setResult({ ok, text: message });
      if (ok) {
        onSuccess?.(message);
      }
    },
    onError: (err) =>
      setResult({ ok: false, text: getApiErrorMessage(err, 'Não foi possível importar a planilha.') }),
  });

  const handleClose = () => {
    setCsv('');
    setImportErrors([]);
    setResult(null);
    onClose();
  };

  const loadText = (text: string) => {
    setCsv(text);
    setImportErrors([]);
    setResult(null);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-esus-sigaps.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const previewLines = useMemo(() => csv.split(/\r?\n/).filter(Boolean).length, [csv]);

  const summary = useMemo(() => {
    if (previewLines < 2) return null;
    const dataLines = csv
      .split(/\r?\n/)
      .slice(1)
      .filter((l) => l.trim());
    let families = 0;
    let inhabitants = 0;
    for (const line of dataLines) {
      const cols = line.split(/[;,]/).map((c) => c.trim());
      families += Math.max(0, parseInt(cols[1] ?? '0', 10) || 0);
      inhabitants += Math.max(0, parseInt(cols[2] ?? '0', 10) || 0);
    }
    return `${dataLines.length} linha(s) · ${families} famílias · ${inhabitants} habitantes`;
  }, [csv, previewLines]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      data-testid="esus-import-dialog"
    >
      <DialogTitle sx={{ fontWeight: 800 }}>Importar piloto e-SUS (CSV)</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Aceita colunas como <code>no_logradouro</code>, <code>qt_familia</code>,{' '}
          <code>nu_moradores</code> ou o formato simples <code>rua;familias;habitantes</code>.
          As ruas devem já existir no SIGAPS — o sistema casa pelo nome do logradouro.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Download />} onClick={downloadTemplate}>
            Baixar modelo
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<Upload />}
            onClick={() => fileRef.current?.click()}
          >
            Escolher CSV
          </Button>
        </Box>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => loadText(String(reader.result ?? ''));
            reader.readAsText(file);
            e.target.value = '';
          }}
        />

        <TextField
          label="Ou cole o CSV exportado"
          multiline
          minRows={6}
          value={csv}
          onChange={(e) => loadText(e.target.value)}
          placeholder={'no_logradouro;qt_familia;nu_moradores\nRua A;12;45'}
          fullWidth
        />

        {summary && <Alert severity="info">{summary}</Alert>}
        {result && <Alert severity={result.ok ? 'success' : 'error'}>{result.text}</Alert>}

        {importErrors.length > 0 && (
          <Alert severity="warning">
            <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: '0.85rem' }}>
              {importErrors.slice(0, 8).map((e) => (
                <li key={`${e.row}-${e.streetRef}`}>
                  Linha {e.row}: {e.streetRef} — {e.message}
                </li>
              ))}
              {importErrors.length > 8 && <li>… e mais {importErrors.length - 8}</li>}
            </Box>
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fechar</Button>
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
