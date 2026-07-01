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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Microarea, Street } from '../../services/api';

interface StreetPanelProps {
  street: Street;
  microareas: Microarea[];
  onClose: () => void;
  onAssign: (microareaId: string) => void;
  assigning: boolean;
}

export function StreetPanel({
  street,
  microareas,
  onClose,
  onAssign,
  assigning,
}: StreetPanelProps) {
  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 100,
        right: 16,
        zIndex: 1000,
        width: 320,
        maxHeight: 'calc(100vh - 120px)',
        overflow: 'auto',
        p: 2,
      }}
      elevation={6}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            {street.streetType ?? 'Rua'}
          </Typography>
          <Typography variant="h6">{street.name}</Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Divider sx={{ my: 1.5 }} />

      <InfoRow label="Bairro" value={street.neighborhood?.name ?? '—'} />
      <InfoRow
        label="Microárea"
        value={
          street.microarea ? (
            <Chip
              size="small"
              label={street.microarea.name}
              sx={{ bgcolor: street.microarea.color, color: '#fff' }}
            />
          ) : (
            'Não vinculada'
          )
        }
      />
      <InfoRow label="Comprimento" value={street.lengthMeters ? `${Math.round(street.lengthMeters)} m` : '—'} />
      <InfoRow label="Imóveis" value={street.propertyCount} />
      <InfoRow label="Famílias" value={street.familyCount} />
      <InfoRow label="Habitantes" value={street.inhabitantCount} />
      <InfoRow
        label="Atualização"
        value={new Date(street.updatedAt).toLocaleDateString('pt-BR')}
      />

      {street.notes && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="body2" color="text.secondary">
            {street.notes}
          </Typography>
        </>
      )}

      <Divider sx={{ my: 1.5 }} />
      <Typography variant="subtitle2" gutterBottom>
        Adicionar à Microárea
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {microareas.map((m) => (
          <Button
            key={m.id}
            variant={street.microareaId === m.id ? 'contained' : 'outlined'}
            size="small"
            disabled={assigning}
            onClick={() => onAssign(m.id)}
            sx={{
              justifyContent: 'flex-start',
              borderColor: m.color,
              ...(street.microareaId === m.id && { bgcolor: m.color }),
            }}
          >
            {assigning ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            {m.name}
          </Button>
        ))}
      </Box>
    </Paper>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}