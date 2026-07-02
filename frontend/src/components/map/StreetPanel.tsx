import React from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Button,
  Chip,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
  useMediaQuery,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SignpostIcon from '@mui/icons-material/Signpost';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import AutoFixOffIcon from '@mui/icons-material/AutoFixOff';
import { useQuery } from '@tanstack/react-query';
import { streetsApi, type Microarea, type Neighborhood, type Street } from '../../services/api';

interface StreetPanelProps {
  street: Street;
  microareas: Microarea[];
  neighborhoods: Neighborhood[];
  onClose: () => void;
  onAssign: (microareaId: string) => void;
  onAssignNeighborhood: (neighborhoodId: string | null) => void;
  onUnassign: () => void;
  assigning: boolean;
  assigningNeighborhood: boolean;
  unassigning: boolean;
}

export function StreetPanel({
  street,
  microareas,
  neighborhoods,
  onClose,
  onAssign,
  onAssignNeighborhood,
  onUnassign,
  assigning,
  assigningNeighborhood,
  unassigning,
}: StreetPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const accent = street.microarea?.color ?? theme.palette.primary.main;
  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.92)
    : alpha('#fff', 0.95);

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggest-microarea', street.id],
    queryFn: () => streetsApi.suggest(street.id).then((r) => r.data as Array<{ id: string; name: string; color: string }>),
    enabled: !street.microareaId,
    staleTime: 60_000,
  });

  const topSuggestion = suggestions[0];

  return (
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        top: { xs: 100, sm: 120 },
        right: { xs: 8, sm: 16 },
        left: { xs: 8, sm: 'auto' },
        zIndex: 1000,
        width: { xs: 'auto', sm: 340 },
        maxHeight: { xs: 'calc(100vh - 200px)', sm: 'calc(100vh - 140px)' },
        overflow: 'auto',
        bgcolor: glassBg,
        borderRadius: 3,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(accent, 0.15),
                color: accent,
                flexShrink: 0,
              }}
            >
              <SignpostIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {street.streetType ?? 'Rua'}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {street.name}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Alert severity="info" icon={<LightbulbOutlinedIcon fontSize="small" />} sx={{ mt: 1.5, py: 0.5, borderRadius: 2 }}>
          <Typography variant="caption" component="div">
            {isMobile ? (
              <>Toque em uma rua para ver detalhes e vincular à microárea.</>
            ) : (
              <>
                Segure <strong>Ctrl</strong> (ou <strong>Cmd</strong> no Mac) e clique em várias ruas
                para selecionar e vincular todas de uma vez.
              </>
            )}
          </Typography>
        </Alert>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          <StatBox label="Imóveis" value={street.propertyCount} />
          <StatBox label="Famílias" value={street.familyCount} />
          <StatBox label="Habitantes" value={street.inhabitantCount} />
          <StatBox
            label="Comprimento"
            value={street.lengthMeters ? `${Math.round(street.lengthMeters)} m` : '—'}
          />
        </Box>

        <InfoRow label="Bairro" value={street.neighborhood?.name ?? '—'} />
        <InfoRow
          label="Microárea"
          value={
            street.microarea ? (
              <Chip
                size="small"
                label={street.microarea.name}
                sx={{ bgcolor: street.microarea.color, color: '#fff', fontWeight: 600 }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">Não vinculada</Typography>
            )
          }
        />
        <InfoRow
          label="Atualização"
          value={new Date(street.updatedAt).toLocaleDateString('pt-BR')}
        />

        {street.notes && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.action.hover, 0.5) }}>
            <Typography variant="body2" color="text.secondary">{street.notes}</Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {street.microareaId && (
          <Button
            fullWidth
            variant="outlined"
            color="warning"
            size="medium"
            disabled={unassigning}
            startIcon={<AutoFixOffIcon />}
            onClick={onUnassign}
            sx={{ mb: 2, fontWeight: 700, borderWidth: 2 }}
          >
            {unassigning ? 'Removendo…' : 'Remover pintura desta rua'}
          </Button>
        )}

        {!street.microareaId && topSuggestion && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Sugestão automática
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              size="small"
              disabled={assigning}
              onClick={() => onAssign(topSuggestion.id)}
              sx={{ borderColor: topSuggestion.color, justifyContent: 'flex-start', gap: 1 }}
            >
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: topSuggestion.color }} />
              Vincular à {topSuggestion.name}
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {neighborhoods.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Bairro
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Atribuir bairro</InputLabel>
              <Select
                label="Atribuir bairro"
                value={street.neighborhood?.id ?? ''}
                disabled={assigningNeighborhood}
                onChange={(e) => {
                  const v = e.target.value;
                  onAssignNeighborhood(v === '' ? null : String(v));
                }}
              >
                <MenuItem value="">
                  <em>Sem bairro</em>
                </MenuItem>
                {neighborhoods.map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
          Vincular à microárea
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {microareas.map((m) => {
            const selected = street.microareaId === m.id;
            return (
              <Button
                key={m.id}
                variant={selected ? 'contained' : 'outlined'}
                size="small"
                disabled={assigning}
                onClick={() => onAssign(m.id)}
                sx={{
                  justifyContent: 'flex-start',
                  gap: 1,
                  borderColor: m.color,
                  ...(selected && { bgcolor: m.color, '&:hover': { bgcolor: m.color, filter: 'brightness(0.92)' } }),
                }}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selected ? '#fff' : m.color }} />
                {assigning ? <CircularProgress size={14} sx={{ mr: 0.5 }} /> : null}
                {m.name}
              </Button>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ textAlign: 'right' }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
        ) : (
          value
        )}
      </Box>
    </Box>
  );
}
