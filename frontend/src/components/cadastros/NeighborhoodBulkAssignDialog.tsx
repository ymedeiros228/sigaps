import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { Upload, Download } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { streetsApi } from '../../services/api';

const CSV_TEMPLATE = `rua;bairro
Rua Coronel Manoel Bandeira;Centro
Avenida Principal;São José`;

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim());
  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const streetIdx = col(['rua', 'street', 'nome', 'name']);
  const hoodIdx = col(['bairro', 'neighborhood', 'neighbourhood']);

  const dataLines = streetIdx >= 0 || hoodIdx >= 0 ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
      const streetRef = parts[streetIdx >= 0 ? streetIdx : 0];
      const neighborhoodRef = parts[hoodIdx >= 0 ? hoodIdx : 1];
      if (!streetRef || !neighborhoodRef) return null;
      return { streetRef, neighborhoodRef };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

interface NeighborhoodBulkAssignDialogProps {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}

export function NeighborhoodBulkAssignDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
  onError,
}: NeighborhoodBulkAssignDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseCsv>>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<
    Array<{ row: number; streetRef: string; message: string }>
  >([]);

  const importMutation = useMutation({
    mutationFn: () => streetsApi.bulkNeighborhood(municipalityId, preview),
    onSuccess: (res) => {
      const { updated, errors } = res.data;
      setImportErrors(errors);
      let msg = `${updated} vínculo(s) rua-bairro aplicado(s).`;
      if (errors.length > 0) msg += ` ${errors.length} linha(s) com aviso.`;
      if (updated > 0) {
        onSuccess(msg);
        if (errors.length === 0) handleClose();
      } else if (errors.length > 0) {
        setParseError('Nenhuma rua foi vinculada. Veja os avisos abaixo.');
      }
    },
    onError,
  });

  const handleClose = () => {
    setPreview([]);
    setParseError(null);
    setImportErrors([]);
    onClose();
  };

  const loadText = (text: string) => {
    try {
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setParseError('Nenhuma linha válida. Use colunas rua e bairro.');
        setPreview([]);
        return;
      }
      setParseError(null);
      setImportErrors([]);
      setPreview(rows);
    } catch {
      setParseError('Arquivo inválido.');
      setPreview([]);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-ruas-bairros-sigaps.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (preview.length === 0) return null;
    const hoods = new Set(preview.map((r) => r.neighborhoodRef));
    return `${preview.length} linha(s) · ${hoods.size} bairro(s) distintos`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Vincular ruas aos bairros</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Cadastre os bairros primeiro. Depois envie uma planilha com o nome da rua e o bairro
          correspondente. O sistema casa pelo nome da rua no município.
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

        {parseError && <Alert severity="warning">{parseError}</Alert>}
        {summary && <Alert severity="info">{summary}</Alert>}

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
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>Fechar</Button>
        <Button
          variant="contained"
          disabled={preview.length === 0 || importMutation.isPending}
          onClick={() => importMutation.mutate()}
        >
          {importMutation.isPending ? 'Vinculando…' : `Vincular ${preview.length || ''} linha(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
