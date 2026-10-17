import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import type { ReactNode } from 'react';

type CadastrosSectionHeaderProps = {
  title: string;
  description?: string;
  count?: number;
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchExtra?: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
  canManage?: boolean;
  extra?: ReactNode;
};

export function CadastrosSectionHeader({
  title,
  description,
  count,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  searchExtra,
  onAdd,
  addLabel,
  canManage = true,
  extra,
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
            <Typography
              variant="h6"
              component="h2"
              sx={{ fontWeight: 700, lineHeight: 1.3, textWrap: 'balance' }}
            >
              {title}
            </Typography>
            {count !== undefined && (
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count} {count === 1 ? 'registro' : 'registros'}
              </Typography>
            )}
          </Box>
          {description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5, maxWidth: '65ch', textWrap: 'pretty' }}
            >
              {description}
            </Typography>
          )}
        </Box>

        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            // No dedo, os botões da seção ganham altura de toque confortável.
            '@media (pointer: coarse)': {
              '& .MuiButton-root, & .MuiToggleButton-root': { minHeight: 44 },
            },
          }}
        >
          {extra}
          {canManage && onAdd && addLabel && (
            <Button startIcon={<Add />} variant="contained" size="small" onClick={onAdd}>
              {addLabel}
            </Button>
          )}
        </Box>
      </Box>

      {(onSearchChange || searchExtra) && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
            '@media (pointer: coarse)': {
              '& .MuiToggleButton-root': { minHeight: 44 },
              '& .MuiInputBase-root': { minHeight: 44 },
            },
          }}
        >
          {onSearchChange && (
            <TextField
              size="small"
              type="search"
              placeholder={searchPlaceholder}
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              sx={{ maxWidth: { sm: 360 }, width: '100%', flex: { xs: '1 1 100%', sm: '1 1 280px' } }}
              slotProps={{
                htmlInput: { 'aria-label': searchPlaceholder.replace(/\.+$/, '') },
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
          {searchExtra}
        </Box>
      )}
    </Box>
  );
}
