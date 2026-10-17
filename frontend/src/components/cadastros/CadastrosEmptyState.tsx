import { Box, Button, Typography } from '@mui/material';
import type { ReactNode } from 'react';

type CadastrosEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
};

/** Estado vazio: diz o que falta e oferece o próximo passo logo abaixo. */
export function CadastrosEmptyState({ icon, title, description, action }: CadastrosEmptyStateProps) {
  return (
    <Box
      role="status"
      sx={{
        py: { xs: 4, sm: 6 },
        px: { xs: 2, sm: 3 },
        textAlign: 'center',
        borderRadius: 1,
        border: '1px dashed',
        borderColor: 'divider',
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          mx: 'auto',
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          '& .MuiSvgIcon-root': { fontSize: 28 },
        }}
      >
        {icon}
      </Box>
      <Typography variant="subtitle1" component="p" sx={{ fontWeight: 700, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 400, mx: 'auto', mb: action ? 2.5 : 0, textWrap: 'pretty' }}
      >
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
  /** Ação alternativa (contorno). Só a ação principal fica cheia, na cor da marca. */
  secondary?: boolean;
};

export function CadastrosEmptyAction({ label, onClick, icon, secondary = false }: CadastrosEmptyActionProps) {
  return (
    <Button variant={secondary ? 'outlined' : 'contained'} startIcon={icon} onClick={onClick}>
      {label}
    </Button>
  );
}
