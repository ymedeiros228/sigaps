import { Box, Button, InputAdornment, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Add, Search, SortByAlpha, Tag } from '@mui/icons-material';
import type { ReactNode } from 'react';
import type { MicroareaSortMode } from '../../utils/sortMicroareas';

type CadastrosSectionHeaderProps = {
  title: string;
  description?: string;
  count?: number;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  onAdd?: () => void;
  addLabel?: string;
  canManage?: boolean;
  extra?: ReactNode;
  sortMode?: MicroareaSortMode;
  onSortModeChange?: (mode: MicroareaSortMode) => void;
};

export function CadastrosSectionHeader({
  title,
  description,
  count,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  onAdd,
  addLabel,
  canManage = true,
  extra,
  sortMode,
  onSortModeChange,
}: CadastrosSectionHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            {count !== undefined && (
              <Typography
                component="span"
                variant="caption"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  fontWeight: 700,
                }}
              >
                {count} {count === 1 ? 'registro' : 'registros'}
              </Typography>
            )}
          </Box>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {description}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          {extra}
          {canManage && onAdd && addLabel && (
            <Button startIcon={<Add />} variant="contained" size="small" onClick={onAdd}>
              {addLabel}
            </Button>
          )}
        </Box>
      </Box>

      {(onSearchChange || onSortModeChange) && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {onSearchChange && (
            <TextField
              size="small"
              placeholder={searchPlaceholder}
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              sx={{ maxWidth: 360, width: '100%', flex: { xs: '1 1 100%', sm: '1 1 280px' } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          )}
          {onSortModeChange && sortMode && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={sortMode}
              onChange={(_, value) => value && onSortModeChange(value)}
              aria-label="Ordenação da lista"
            >
              <ToggleButton value="number" aria-label="Ordenar por número">
                <Tag fontSize="small" sx={{ mr: 0.75 }} />
                Nº
              </ToggleButton>
              <ToggleButton value="name" aria-label="Ordenar por nome">
                <SortByAlpha fontSize="small" sx={{ mr: 0.75 }} />
                Nome
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
      )}
    </Box>
  );
}
