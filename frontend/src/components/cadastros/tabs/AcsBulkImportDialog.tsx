import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { ContentPaste, Upload, Download } from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { acsApi } from '../../../services/api';
import { digitsOnly } from '../../../utils/inputMasks';

const CSV_TEMPLATE = `nome;cpf;telefone;microarea;status
Maria Silva;12345678901;98999998888;Microárea 01;ATIVO
João Santos;98765432100;98988887777;02;ATIVO`;

type ImportError = { row: number; cpf: string; message: string };

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length === 0) return [];

  const sep = lines[0].includes(';') ? ';' : ',';
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim());

  const col = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

  const nameIdx = col(['nome', 'name']);
  const cpfIdx = col(['cpf']);
  const phoneIdx = col(['telefone', 'phone', 'celular']);
  const microIdx = col(['microarea', 'microárea', 'micro']);
  const statusIdx = col(['status', 'situacao']);

  const dataLines = nameIdx >= 0 || cpfIdx >= 0 ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ''));
      const name = parts[nameIdx >= 0 ? nameIdx : 0];
      const cpf = digitsOnly(parts[cpfIdx >= 0 ? cpfIdx : 1]);
      if (!name || cpf.length !== 11) return null;
      return {
        name,
        cpf,
        phone: phoneIdx >= 0 ? parts[phoneIdx] : undefined,
        microareaRef: microIdx >= 0 ? parts[microIdx] : undefined,
        status: statusIdx >= 0 ? parts[statusIdx]?.toUpperCase() : 'ATIVO',
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
}

interface AcsBulkImportDialogProps {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}

export function AcsBulkImportDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
  onError,
}: AcsBulkImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof parseCsv>>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: ImportError[];
  } | null>(null);

  const importMutation = useMutation({
    mutationFn: () => acsApi.bulkImport(municipalityId, preview),
    onSuccess: (res) => {
      const { created, updated, errors } = res.data;
      setImportResult({ created, updated, errors });
      let msg = `Importação concluída: ${created} novo(s), ${updated} atualizado(s).`;
      if (errors.length > 0) {
        msg += ` ${errors.length} linha(s) com aviso.`;
      }
      onSuccess(msg);
    },
    onError,
  });

  const resetState = () => {
    setPasteText('');
    setPreview([]);
    setParseError(null);
    setImportResult(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const loadText = (text: string) => {
    try {
      const rows = parseCsv(text);
      if (rows.length === 0) {
        setParseError('Nenhuma linha válida encontrada. Use o modelo CSV.');
        setPreview([]);
        return;
      }
      setParseError(null);
      setPreview(rows);
      setImportResult(null);
    } catch {
      setParseError('Conteúdo inválido. Use CSV com colunas nome e CPF.');
      setPreview([]);
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) {
      setParseError('Cole os dados da planilha no campo acima.');
      return;
    }
    loadText(pasteText);
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-acs-sigaps.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (preview.length === 0) return null;
    const withMicro = preview.filter((r) => r.microareaRef).length;
    return `${preview.length} agente(s) · ${withMicro} com microárea indicada`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Importar ACS da planilha</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Cole os dados do Excel ou Google Planilhas, ou envie um arquivo CSV (separador{' '}
          <strong>;</strong> ou vírgula).
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Download />} onClick={downloadTemplate}>
            Baixar modelo
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => fileRef.current?.click()}
          >
            Escolher arquivo
          </Button>
        </Box>

        <TextField
          label="Colar dados da planilha"
          placeholder={'nome;cpf;telefone;microarea;status\nMaria Silva;12345678901;...'}
          multiline
          minRows={4}
          maxRows={10}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          fullWidth
          size="small"
        />

        <Button
          size="small"
          variant="contained"
          startIcon={<ContentPaste />}
          onClick={handlePaste}
          disabled={!pasteText.trim()}
          sx={{ alignSelf: 'flex-start' }}
        >
          Analisar dados colados
        </Button>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const text = String(reader.result ?? '');
              setPasteText(text);
              loadText(text);
            };
            reader.readAsText(file);
            e.target.value = '';
          }}
        />

        {parseError && <Alert severity="warning">{parseError}</Alert>}

        {summary && !importResult && (
          <Alert severity="info">
            {summary}
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, fontSize: '0.85rem' }}>
              {preview.slice(0, 5).map((r) => (
                <li key={r.cpf}>
                  {r.name} — CPF {r.cpf.slice(0, 3)}…
                  {r.microareaRef ? ` · ${r.microareaRef}` : ''}
                </li>
              ))}
              {preview.length > 5 && (
                <li>
                  <em>… e mais {preview.length - 5}</em>
                </li>
              )}
            </Box>
          </Alert>
        )}

        <Collapse in={!!importResult}>
          {importResult && (
            <Alert severity={importResult.errors.length > 0 ? 'warning' : 'success'}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {importResult.created} novo(s), {importResult.updated} atualizado(s)
                {importResult.errors.length > 0 && ` · ${importResult.errors.length} com aviso`}
              </Typography>
              {importResult.errors.length > 0 && (
                <Box
                  component="ul"
                  sx={{
                    m: 0,
                    mt: 1,
                    pl: 2.5,
                    fontSize: '0.85rem',
                    maxHeight: 160,
                    overflow: 'auto',
                  }}
                >
                  {importResult.errors.map((err) => (
                    <li key={`${err.row}-${err.cpf}`}>
                      Linha {err.row} (CPF …{err.cpf.slice(-4)}): {err.message}
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          )}
        </Collapse>

        <Typography variant="caption" color="text.secondary">
          Colunas: <strong>nome</strong>, <strong>cpf</strong> (11 dígitos), telefone, microarea
          (nome ou número), status (ATIVO/INATIVO). CPF já cadastrado será atualizado.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>{importResult ? 'Fechar' : 'Cancelar'}</Button>
        {!importResult && (
          <Button
            variant="contained"
            disabled={preview.length === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? 'Importando…' : `Importar ${preview.length || ''} ACS`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
