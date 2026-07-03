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
import { municipalitiesApi, placesApi } from '../../../services/api';
import { GeoImportPreviewMap } from '../GeoImportPreviewMap';
import {
  PLACES_CSV_TEMPLATE,
  downloadPlacesImportTemplateXlsx,
  parsePlacesCsvText,
  parsePlacesExcelFile,
  type PlaceImportRow,
} from '../../../utils/parsePlacesSpreadsheet';
import { cadastrosQueryDefaults } from '../../../utils/cadastrosQuery';
import { queryKeys } from '../../../utils/queryKeys';

type ImportError = { row: number; name: string; message: string };

interface PlacesBulkImportDialogProps {
  open: boolean;
  municipalityId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  onError: (error: unknown) => void;
}

export function PlacesBulkImportDialog({
  open,
  municipalityId,
  onClose,
  onSuccess,
  onError,
}: PlacesBulkImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [preview, setPreview] = useState<PlaceImportRow[]>([]);
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

  const previewPoints = useMemo(
    () =>
      preview.map((row) => ({
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        subtitle: [row.ubsRef ? `UBS: ${row.ubsRef}` : '', row.notes].filter(Boolean).join(' · '),
        markerColor: '#6D4C41',
      })),
    [preview],
  );

  const importMutation = useMutation({
    mutationFn: () =>
      placesApi.bulkImport(
        municipalityId,
        preview.map((row) => ({
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          kind: row.kind,
          ubsRef: row.ubsRef,
          notes: row.notes,
        })),
      ),
    onSuccess: (res) => {
      const { created, updated, errors } = res.data;
      setImportResult({ created, updated, errors });
      let msg = `Importação concluída: ${created} novo(s), ${updated} atualizado(s). Marcadores no mapa atualizados.`;
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

  const applyPreview = (rows: PlaceImportRow[]) => {
    if (rows.length === 0) {
      setParseError(
        'Nenhum povoado válido. Informe povoado/nome e latitude/longitude (ou coluna coordenadas).',
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
      applyPreview(parsePlacesCsvText(text));
    } catch {
      setParseError('Conteúdo inválido. Use o modelo Excel/CSV.');
      setPreview([]);
    }
  };

  const downloadCsvTemplate = () => {
    const blob = new Blob([PLACES_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-povoados-sigaps.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => {
    if (preview.length === 0) return null;
    const withUbs = preview.filter((row) => row.ubsRef).length;
    return `${preview.length} povoado(s) · ${withUbs} com UBS de referência`;
  }, [preview]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Importar povoados da planilha</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Envie Excel (.xlsx) ou CSV com <strong>povoado</strong>, <strong>coordenadas</strong> e{' '}
          <strong>UBS</strong>. O sistema marca cada local automaticamente no mapa.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download />}
            onClick={() => void downloadPlacesImportTemplateXlsx()}
          >
            Modelo Excel
          </Button>
          <Button size="small" variant="outlined" startIcon={<Download />} onClick={downloadCsvTemplate}>
            Modelo CSV
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
          placeholder={'povoado;ubs;latitude;longitude;tipo;observacoes\nBacabinha;UBS Centro;...'}
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
          onClick={() => {
            if (!pasteText.trim()) {
              setParseError('Cole os dados da planilha no campo acima.');
              return;
            }
            loadText(pasteText);
          }}
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
              void parsePlacesExcelFile(file)
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
                  {row.ubsRef ? ` · UBS ${row.ubsRef}` : ''}
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

        {previewPoints.length > 0 && !importResult && (
          <GeoImportPreviewMap
            points={previewPoints}
            center={mapCenter}
            defaultMarkerColor="#6D4C41"
            caption="Marcadores automáticos no mapa satélite — confira povoado, UBS e coordenadas."
          />
        )}

        <Collapse in={!!importResult}>
          {importResult && (
            <Alert severity={importResult.errors.length > 0 ? 'warning' : 'success'}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {importResult.created} novo(s), {importResult.updated} atualizado(s)
                {importResult.errors.length > 0 && ` · ${importResult.errors.length} com aviso`}
              </Typography>
            </Alert>
          )}
        </Collapse>

        <Typography variant="caption" color="text.secondary">
          Colunas: <strong>povoado</strong> (ou nome), <strong>latitude</strong>, <strong>longitude</strong>,
          <strong> ubs</strong> (referência), tipo, observações. Coordenadas do Google Maps na coluna{' '}
          <strong>coordenadas</strong> também funcionam.
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
            {importMutation.isPending ? 'Importando…' : `Marcar ${preview.length || ''} no mapa`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
