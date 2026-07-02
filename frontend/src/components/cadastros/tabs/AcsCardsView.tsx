import {
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Delete, Edit, GridView } from '@mui/icons-material';
import type { Acs } from '../../../services/api';
import { isInternalAcsCode } from '../../../utils/inputMasks';
import { assetUrl } from '../../../utils/assetUrl';

interface AcsCardsViewProps {
  rows: Acs[];
  canManage: boolean;
  canDelete: boolean;
  onEdit: (acs: Acs) => void;
  onDelete: (acs: Acs) => void;
  onGoToMicroareas?: () => void;
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

export function AcsCardsView({
  rows,
  canManage,
  canDelete,
  onEdit,
  onDelete,
  onGoToMicroareas,
}: AcsCardsViewProps) {
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
        const color = acs.microarea?.color ?? theme.palette.grey[400];
        const hasMicro = !!acs.microarea;
        return (
          <Paper
            key={acs.id}
            variant="outlined"
            sx={{
              borderRadius: 2.5,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              transition: 'box-shadow 0.2s, transform 0.15s',
              '&:hover': { boxShadow: theme.shadows[3], transform: 'translateY(-1px)' },
            }}
          >
            <Box
              sx={{
                height: 4,
                bgcolor: hasMicro ? color : theme.palette.warning.light,
              }}
            />

            <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <Avatar
                  src={assetUrl(acs.photoUrl) ?? undefined}
                  sx={{
                    width: 52,
                    height: 52,
                    bgcolor: alpha(hasMicro ? color : theme.palette.primary.main, 0.12),
                    color: hasMicro ? color : theme.palette.primary.main,
                    fontWeight: 800,
                    fontSize: '1rem',
                    border: 2,
                    borderColor: alpha(hasMicro ? color : theme.palette.primary.main, 0.25),
                  }}
                >
                  {initials(acs.name)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ lineHeight: 1, fontSize: '0.65rem', letterSpacing: 1 }}
                  >
                    Agente Comunitário
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                    {acs.name}
                  </Typography>
                  {!isInternalAcsCode(acs.cpf) && acs.cpf && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      CPF cadastrado
                    </Typography>
                  )}
                </Box>
                {canManage && (
                  <Box sx={{ display: 'flex', gap: 0.25, mt: -0.5 }}>
                    <Tooltip title="Editar ficha">
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

              <Divider sx={{ my: 0.25 }} />

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                {hasMicro ? (
                  <Chip
                    icon={<GridView sx={{ fontSize: '14px !important' }} />}
                    label={`${acs.microarea!.number} · ${acs.microarea!.name}`}
                    size="small"
                    sx={{ bgcolor: acs.microarea!.color, color: '#fff', fontWeight: 600 }}
                  />
                ) : (
                  <Chip label="Sem microárea" size="small" color="warning" variant="outlined" />
                )}
                <Chip
                  label={acs.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                  size="small"
                  color={acs.status === 'ATIVO' ? 'success' : 'default'}
                  variant="outlined"
                />
              </Box>

              {canManage && !hasMicro && onGoToMicroareas && (
                <Button
                  size="small"
                  variant="text"
                  startIcon={<GridView />}
                  onClick={onGoToMicroareas}
                  sx={{ alignSelf: 'flex-start', mt: -0.5, px: 0.5 }}
                >
                  Vincular em Microáreas
                </Button>
              )}
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
