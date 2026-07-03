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
import { useMutation, useQuery } from '@tanstack/react-query';
import { municipalitiesApi, ubsApi } from '../../../services/api';
import { UbsImportPreviewMap } from '../UbsImportPreviewMap';
import {
  UBS_CSV_TEMPLATE,
  downloadUbsImportTemplateXlsx,
  parseUbsCsvText,
  parseUbsExcelFile,
  type UbsImportRow,
} from '../../../utils/parseUbsSpreadsheet';
import { cadastrosQueryDefaults } from '../../../utils/cadastrosQuery';
import { queryKeys } from '../../../utils/queryKeys';

type ImportError = { row: number; name: string; message: string };

interface UbsBulkImportDialogProps {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}

export function UbsBulkImportDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
  onError,
}: UbsBulkImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<UbsImportRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: ImportError[];
  } | null>(null);

  const { data: municipality } = useQuery({
    queryKey: queryKeys.municipality(municipalityId),
    queryFn: () => municipalitiesApi.get(municipalityId).then((r) => r.data),
    enabled: open && !!municipalityId,
    ...cadastrosQueryDefaults,
  });

  const mapCenter = useMemo(
    () => ({
      lat: municipality?.latitude ?? -6.1828,
      lng: municipality?.longitude ?? -43.7869,
    }),
    [municipality?.latitude, municipality?.longitude],
  );

  const importMutation = useMutation({
    mutationFn: () => ubsApi.bulkImport(municipalityId, preview),
    onSuccess: (res) => {
      const { created, updated, errors } = res.data;
      setImportResult({ created, updated, errors });
      let msg = `Importação concluída: ${created} nova(s), ${updated} atualizada(s).`;
      if (errors.length > 0) msg += ` ${errors.length} linha(s) com aviso.`;
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

  const applyPreview = (rows: UbsImportRow[]) => {
    if (rows.length === 0) {
      setParseError(
        'Nenhuma UBS válida encontrada. Informe nome e latitude/longitude (ou coluna coordenadas).',
      );
      setPreview([]);
      return;
    }
    setParseError(null);
    setPreview(rows);
    setImportResult(null);
  };

  const loadText = (text: string) => {
    try {
      applyPreview(parseUbsCsvText(text));
    } catch {
      setParseError('Conteúdo inválido. Use o modelo Excel/CSV com nome e coordenadas.');
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

  const downloadCsvTemplate = () => {
    const blob = new Blob([UBS_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-ubs-sigaps.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (preview.length === 0) return null;
    const withCnes = preview.filter((row) => row.cnesCode).length;
    return `${preview.length} UBS · ${withCnes} com CNES`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Importar UBS da planilha</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Envie um arquivo Excel (.xlsx), CSV ou cole os dados do Google Planilhas. Cada linha deve ter{' '}
          <strong>nome</strong> e <strong>coordenadas geográficas</strong> para marcar a UBS no mapa.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download />}
            onClick={() => void downloadUbsImportTemplateXlsx()}
          >
            Modelo Excel
          </Button>
          <Button size="small" variant="outlined" startIcon={<Download />} onClick={downloadCsvTemplate}>
            Modelo CSV
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download />}
            component="a"
            href="/templates/banco_localizacoes_coordenadas.xlsx"
            download="banco_localizacoes_coordenadas.xlsx"
          >
            Exemplo Passagem Franca
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
          placeholder={'nome;endereco;latitude;longitude;telefone;coordenador;cnes\nUBS Centro;...'}
          multiline
          minRows={4}
          maxRows={8}
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
          accept=".xlsx,.xls,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const lower = file.name.toLowerCase();
            if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
              void parseUbsExcelFile(file)
                .then((rows) => {
                  setPasteText(`Arquivo: ${file.name} (${rows.length} linha(s))`);
                  applyPreview(rows);
                })
                .catch(() => {
                  setParseError('Não foi possível ler o Excel. Baixe o modelo e tente novamente.');
                  setPreview([]);
                });
            } else {
              const reader = new FileReader();
              reader.onload = () => {
                const text = String(reader.result ?? '');
                setPasteText(text);
                loadText(text);
              };
              reader.readAsText(file);
            }
            e.target.value = '';
          }}
        />

        {parseError && <Alert severity="warning">{parseError}</Alert>}

        {summary && !importResult && (
          <Alert severity="info">
            {summary}
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, fontSize: '0.85rem' }}>
              {preview.slice(0, 6).map((row) => (
                <li key={`${row.name}-${row.latitude}`}>
                  {row.name} — {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                  {row.cnesCode ? ` · CNES ${row.cnesCode}` : ''}
                </li>
              ))}
              {preview.length > 6 && (
                <li>
                  <em>… e mais {preview.length - 6}</em>
                </li>
              )}
            </Box>
          </Alert>
        )}

        {preview.length > 0 && !importResult && (
          <UbsImportPreviewMap rows={preview} center={mapCenter} />
        )}

        <Collapse in={!!importResult}>
          {importResult && (
            <Alert severity={importResult.errors.length > 0 ? 'warning' : 'success'}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {importResult.created} nova(s), {importResult.updated} atualizada(s)
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
                    <li key={`${err.row}-${err.name}`}>
                      Linha {err.row} ({err.name}): {err.message}
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          )}
        </Collapse>

        <Typography variant="caption" color="text.secondary">
          Colunas aceitas: <strong>nome</strong> ou <strong>nome do local</strong>, <strong>latitude</strong>,{' '}
          <strong>longitude</strong> (ou <strong>coordenadas</strong> no formato -6.18, -43.78), endereco,
          telefone, coordenador, cnes. UBS já cadastrada (mesmo CNES ou nome) será atualizada com as novas
          coordenadas e marcada no mapa.
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
            {importMutation.isPending ? 'Importando…' : `Importar ${preview.length || ''} UBS`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
