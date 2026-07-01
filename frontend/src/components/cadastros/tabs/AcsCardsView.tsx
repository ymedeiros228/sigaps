import {
  Avatar,
  Box,
  Chip,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Delete, Edit, Phone } from '@mui/icons-material';
import type { Acs } from '../../../services/api';
import { maskCpfDisplay } from '../../../utils/inputMasks';

interface AcsCardsViewProps {
  rows: Acs[];
  canManage: boolean;
  canDelete: boolean;
  onEdit: (acs: Acs) => void;
  onDelete: (acs: Acs) => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export function AcsCardsView({ rows, canManage, canDelete, onEdit, onDelete }: AcsCardsViewProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
        },
        gap: 2,
      }}
    >
      {rows.map((acs) => {
        const color = acs.microarea?.color ?? theme.palette.primary.main;
        return (
          <Paper
            key={acs.id}
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: 3,
              borderLeft: `4px solid ${color}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              transition: 'box-shadow 0.2s',
              '&:hover': { boxShadow: theme.shadows[2] },
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: alpha(color, 0.15),
                  color,
                  fontWeight: 800,
                  fontSize: '1rem',
                }}
              >
                {initials(acs.name)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }} noWrap>
                  {acs.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  CPF {maskCpfDisplay(acs.cpf)}
                </Typography>
                {acs.phone && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      {acs.phone}
                    </Typography>
                  </Box>
                )}
              </Box>
              {canManage && (
                <Box sx={{ display: 'flex', gap: 0.25 }}>
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => onEdit(acs)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canDelete && (
                    <Tooltip title="Remover">
                      <IconButton size="small" color="error" onClick={() => onDelete(acs)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
              {acs.microarea ? (
                <Chip
                  label={acs.microarea.name}
                  size="small"
                  sx={{ bgcolor: acs.microarea.color, color: '#fff', fontWeight: 600 }}
                />
              ) : (
                <Chip label="Sem microárea" size="small" variant="outlined" />
              )}
              <Chip
                label={acs.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                size="small"
                color={acs.status === 'ATIVO' ? 'success' : 'default'}
                variant="outlined"
              />
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
