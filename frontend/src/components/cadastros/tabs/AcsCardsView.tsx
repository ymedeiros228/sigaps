import { Avatar, Box, Button, Chip, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import { Delete, Edit, GridView } from '@mui/icons-material';
import type { Acs } from '../../../services/api';
import { isInternalAcsCode } from '../../../utils/inputMasks';
import { assetUrl } from '../../../utils/assetUrl';
import { MicroareaDot } from '../MicroareaDot';

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

/** Botões de ícone com alvo de toque ≥ 44 px no celular. */
const touchIconSx = {
  '@media (pointer: coarse)': { width: 44, height: 44 },
} as const;

export function AcsCardsView({
  rows,
  canManage,
  canDelete,
  onEdit,
  onDelete,
  onGoToMicroareas,
}: AcsCardsViewProps) {
  return (
    <Box
      component="ul"
      aria-label="Agentes comunitários"
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(3, minmax(0, 1fr))',
        },
        gap: 1.5,
      }}
    >
      {rows.map((acs) => {
        const micro = acs.microarea;
        const hasCpf = !isInternalAcsCode(acs.cpf) && !!acs.cpf;
        return (
          <Paper
            key={acs.id}
            component="li"
            variant="outlined"
            sx={{
              borderRadius: 1,
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              minWidth: 0,
            }}
          >
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Avatar
                src={assetUrl(acs.photoUrl) ?? undefined}
                alt=""
                sx={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  bgcolor: 'action.selected',
                  color: 'text.primary',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  // O anel mostra a cor da microárea sem pintar o texto (legível em qualquer cor).
                  border: 2,
                  borderColor: micro?.color ?? 'divider',
                }}
              >
                {initials(acs.name)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="subtitle1"
                  component="h3"
                  title={acs.name}
                  sx={{
                    fontWeight: 700,
                    lineHeight: 1.3,
                    // Nome completo em até 2 linhas antes de cortar com reticências.
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {acs.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  Agente comunitário{hasCpf ? ' · CPF cadastrado' : ''}
                </Typography>
              </Box>
              {canManage && (
                <Box sx={{ display: 'flex', mt: -0.75, mr: -0.75, flexShrink: 0 }}>
                  <Tooltip title="Editar ficha">
                    <IconButton
                      size="small"
                      aria-label={`Editar ficha de ${acs.name}`}
                      onClick={() => onEdit(acs)}
                      sx={touchIconSx}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canDelete && (
                    <Tooltip title="Remover">
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Remover ${acs.name}`}
                        onClick={() => onDelete(acs)}
                        sx={touchIconSx}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 0.75,
                alignItems: 'center',
                pt: 1.5,
                mt: 'auto',
                borderTop: 1,
                borderColor: 'divider',
              }}
            >
              {micro ? (
                <Chip
                  size="small"
                  variant="outlined"
                  sx={{ maxWidth: '100%', fontVariantNumeric: 'tabular-nums' }}
                  label={
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <MicroareaDot color={micro.color} />
                      {`${micro.number} · ${micro.name}`}
                    </Box>
                  }
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

            {canManage && !micro && onGoToMicroareas && (
              <Button
                size="small"
                variant="text"
                startIcon={<GridView />}
                onClick={onGoToMicroareas}
                sx={{ alignSelf: 'flex-start', mt: -0.5, px: 0.75, '@media (pointer: coarse)': { minHeight: 44 } }}
              >
                Vincular em Microáreas
              </Button>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}
