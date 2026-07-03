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
import {
  parseAcsCsvText,
  parseAcsExcelFile,
  type AcsImportRow,
} from '../../../utils/parseAcsSpreadsheet';

const CSV_TEMPLATE = `UBS;Contato;Nome do ACS;Microarea;CPF;Status;Observacao
UBS Centro;(99) 98421-7828;Maria Silva;01;;ATIVO;
UBS Aeroporto;(99) 98505-5597;João Santos;02;12345678901;ATIVO;`;

type ImportError = { row: number; ref: string; message: string };

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
  const [preview, setPreview] = useState<AcsImportRow[]>([]);
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

  const loadRows = (rows: AcsImportRow[]) => {
    if (rows.length === 0) {
      setParseError('Nenhuma linha válida encontrada. Use a planilha modelo ou confira os cabeçalhos.');
      setPreview([]);
      return;
    }
    setParseError(null);
    setPreview(rows);
    setImportResult(null);
  };

  const loadText = (text: string) => {
    try {
      loadRows(parseAcsCsvText(text));
    } catch {
      setParseError('Conteúdo inválido. Use CSV/Excel com colunas de nome, microárea e contato/telefone.');
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
    const withoutCpf = preview.filter((r) => !r.cpf).length;
    return `${preview.length} agente(s) · ${withMicro} com microárea indicada · ${withoutCpf} sem CPF`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Importar ACS da planilha</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Cole os dados do Excel ou Google Planilhas, ou envie um arquivo CSV/Excel. O CPF
          pode ficar em branco que o sistema gera um código interno.
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
          placeholder={'UBS;Contato;Nome do ACS;Microarea;CPF;Status\nUBS Centro;(99) 98421-7828;Maria Silva;01;;ATIVO'}
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
          accept=".csv,.txt,.xls,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const lower = file.name.toLowerCase();
              if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
                const rows = await parseAcsExcelFile(file);
                setPasteText('');
                loadRows(rows);
              } else {
                const reader = new FileReader();
                reader.onload = () => {
                  const text = String(reader.result ?? '');
                  setPasteText(text);
                  loadText(text);
                };
                reader.readAsText(file);
              }
            } catch {
              setParseError('Não foi possível ler o arquivo. Use CSV, XLS ou XLSX.');
              setPreview([]);
            }
            e.target.value = '';
          }}
        />

        {parseError && <Alert severity="warning">{parseError}</Alert>}

        {summary && !importResult && (
          <Alert severity="info">
            {summary}
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, fontSize: '0.85rem' }}>
              {preview.slice(0, 5).map((r) => (
                <li key={`${r.name}-${r.microareaRef ?? 'sem-micro'}-${r.cpf ?? 'sem-cpf'}`}>
                  {r.name}
                  {r.cpf ? ` — CPF ${r.cpf.slice(0, 3)}…` : ' — sem CPF'}
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
                    <li key={`${err.row}-${err.ref}`}>
                      Linha {err.row} ({err.ref || 'sem identificador'}): {err.message}
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          )}
        </Collapse>

        <Typography variant="caption" color="text.secondary">
          Colunas aceitas: <strong>Nome do ACS</strong>/<strong>nome</strong>,{' '}
          <strong>Contato</strong>/<strong>telefone</strong>, <strong>Microarea</strong>,{' '}
          <strong>CPF</strong> e <strong>Status</strong>. Se o CPF ficar vazio, o sistema gera
          um identificador interno e ainda importa normalmente.
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
