import {
  Paper,
  Typography,
  Button,
  Box,
  IconButton,
  alpha,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Close, Link as LinkIcon, AutoFixOff } from '@mui/icons-material';
import type { Microarea, Neighborhood } from '../../services/api';
import { useMapStore } from '../../store';

interface SelectionBarProps {
  microareas: Microarea[];
  neighborhoods: Neighborhood[];
  count: number;
  onAssign: (microareaId: string) => void;
  onAssignNeighborhood: (neighborhoodId: string | null) => void;
  onUnassign: () => void;
  assigning: boolean;
  assigningNeighborhood: boolean;
  unassigning: boolean;
  hasPaintedSelection: boolean;
}

export function SelectionBar({
  microareas,
  neighborhoods,
  count,
  onAssign,
  onAssignNeighborhood,
  onUnassign,
  assigning,
  assigningNeighborhood,
  unassigning,
  hasPaintedSelection,
}: SelectionBarProps) {
  const theme = useTheme();
  const clearSelection = useMapStore((s) => s.clearSelection);

  if (count === 0) return null;

  return (
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        top: { xs: 72, sm: 88 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1002,
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1, sm: 1.25 },
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 1.5 },
        width: { xs: 'calc(100% - 16px)', sm: 'auto' },
        maxWidth: { xs: '100%', sm: 720 },
        bgcolor: alpha(theme.palette.info.main, 0.12),
        border: `1px solid ${alpha(theme.palette.info.main, 0.35)}`,
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
        <LinkIcon color="info" fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
          {count} rua{count > 1 ? 's' : ''} selecionada{count > 1 ? 's' : ''}
        </Typography>
        <IconButton
          size="small"
          onClick={clearSelection}
          aria-label="Limpar seleção"
          sx={{ display: { xs: 'flex', sm: 'none' } }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
        {neighborhoods.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Bairro</InputLabel>
            <Select
              label="Bairro"
              defaultValue=""
              disabled={assigningNeighborhood}
              onChange={(e) => {
                const v = e.target.value;
                onAssignNeighborhood(v === '' ? null : v);
              }}
            >
              <MenuItem value="">
                <em>Remover bairro</em>
              </MenuItem>
              {neighborhoods.map((n) => (
                <MenuItem key={n.id} value={n.id}>
                  {n.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {hasPaintedSelection && (
          <Button
            size="small"
            variant="outlined"
            color="warning"
            disabled={unassigning}
            startIcon={<AutoFixOff fontSize="small" />}
            onClick={onUnassign}
            sx={{ fontWeight: 700 }}
          >
            Remover pintura
          </Button>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          Microárea:
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', flex: 1 }}>
          {microareas.map((m) => (
            <Button
              key={m.id}
              size="small"
              variant="contained"
              disabled={assigning}
              onClick={() => onAssign(m.id)}
              sx={{
                bgcolor: m.color,
                minWidth: 0,
                px: { xs: 1, sm: 1.5 },
                fontSize: { xs: '0.75rem', sm: '0.8125rem' },
                '&:hover': { bgcolor: m.color, filter: 'brightness(0.92)' },
              }}
            >
              {m.name}
            </Button>
          ))}
        </Box>
      </Box>

      <IconButton
        size="small"
        onClick={clearSelection}
        aria-label="Limpar seleção"
        sx={{ display: { xs: 'none', sm: 'flex' }, ml: 'auto' }}
      >
        <Close fontSize="small" />
      </IconButton>
    </Paper>
  );
}
