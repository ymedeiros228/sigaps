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

const CSV_TEMPLATE = `rua;familias;habitantes
Rua Coronel Manoel Bandeira;12;45
Avenida Principal;8;28`;

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
  const familyIdx = col(['familia', 'famílias', 'familias', 'family']);
  const inhabitantIdx = col(['habitante', 'habitantes', 'inhabitant', 'morador']);
  const propertyIdx = col(['imovel', 'imóveis', 'imoveis', 'property']);

  const dataLines = streetIdx >= 0 || familyIdx >= 0 ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
      const streetRef = parts[streetIdx >= 0 ? streetIdx : 0];
      const familyRaw = parts[familyIdx >= 0 ? familyIdx : 1];
      const inhabitantRaw = parts[inhabitantIdx >= 0 ? inhabitantIdx : 2];
      const propertyRaw = propertyIdx >= 0 ? parts[propertyIdx] : undefined;
      if (!streetRef) return null;
      const familyCount = parseInt(familyRaw ?? '0', 10);
      const inhabitantCount = parseInt(inhabitantRaw ?? '0', 10);
      if (Number.isNaN(familyCount) || Number.isNaN(inhabitantCount)) return null;
      const propertyCount = propertyRaw !== undefined ? parseInt(propertyRaw, 10) : undefined;
      return {
        streetRef,
        familyCount: Math.max(0, familyCount),
        inhabitantCount: Math.max(0, inhabitantCount),
        ...(propertyCount !== undefined && !Number.isNaN(propertyCount)
          ? { propertyCount: Math.max(0, propertyCount) }
          : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

interface FamilyBulkImportDialogProps {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}

export function FamilyBulkImportDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
  onError,
}: FamilyBulkImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ReturnType<typeof parseCsv>>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<
    Array<{ row: number; streetRef: string; message: string }>
  >([]);

  const importMutation = useMutation({
    mutationFn: () => streetsApi.bulkDemographics(municipalityId, preview),
    onSuccess: (res) => {
      const { updated, errors } = res.data;
      setImportErrors(errors);
      let msg = `${updated} rua(s) atualizada(s) com famílias/habitantes.`;
      if (errors.length > 0) msg += ` ${errors.length} linha(s) com aviso.`;
      if (updated > 0) {
        onSuccess(msg);
        if (errors.length === 0) handleClose();
      } else if (errors.length > 0) {
        setParseError('Nenhuma rua foi atualizada. Veja os avisos abaixo.');
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
        setParseError('Nenhuma linha válida. Use colunas rua, familias e habitantes.');
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
    a.download = 'modelo-familias-sigaps.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (preview.length === 0) return null;
    const families = preview.reduce((sum, r) => sum + r.familyCount, 0);
    const inhabitants = preview.reduce((sum, r) => sum + r.inhabitantCount, 0);
    return `${preview.length} linha(s) · ${families} famílias · ${inhabitants} habitantes`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Importar famílias e habitantes</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Envie uma planilha com o nome da rua, quantidade de famílias e habitantes.
          O sistema casa pelo nome da rua no município.
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
          {importMutation.isPending ? 'Importando…' : `Importar ${preview.length || ''} linha(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
