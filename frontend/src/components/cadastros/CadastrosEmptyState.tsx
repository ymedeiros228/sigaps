import { Box, Button, Typography, alpha, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

type CadastrosEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

export function CadastrosEmptyState({ icon, title, description, action }: CadastrosEmptyStateProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        py: 6,
        px: 3,
        textAlign: 'center',
        borderRadius: 3,
        border: '1px dashed',
        borderColor: 'divider',
        bgcolor: alpha(theme.palette.background.default, 0.35),
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 3,
          mx: 'auto',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          color: 'primary.main',
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, mx: 'auto', mb: action ? 2.5 : 0 }}>
        {description}
      </Typography>
      {action}
    </Box>
  );
}

type CadastrosEmptyActionProps = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
};

export function CadastrosEmptyAction({ label, onClick, icon }: CadastrosEmptyActionProps) {
  return (
    <Button variant="contained" startIcon={icon} onClick={onClick}>
      {label}
    </Button>
  );
}
