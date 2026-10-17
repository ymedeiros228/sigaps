import type React from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { CADASTROS_SECTIONS, type CadastrosSectionId } from './cadastrosConfig';

type CadastrosNavProps = {
  section: CadastrosSectionId;
  onChange: (section: CadastrosSectionId) => void;
  highlightAcs?: boolean;
  onSectionHover?: (section: CadastrosSectionId) => void;
};

export function CadastrosNav({ section, onChange, highlightAcs, onSectionHover }: CadastrosNavProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const sectionIndex = CADASTROS_SECTIONS.findIndex((item) => item.id === section);

  // Celular e tablet: abas roláveis na horizontal (o polegar alcança e nada vaza da tela).
  if (isMobile) {
    return (
      <Tabs
        value={sectionIndex}
        onChange={(_, index) => onChange(CADASTROS_SECTIONS[index].id)}
        variant="scrollable"
        scrollButtons={false}
        aria-label="Seções de cadastro"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 48,
          px: 0.5,
          '& .MuiTab-root': { minHeight: 48, minWidth: 0, px: 1.75, gap: 0.75 },
        }}
      >
        {CADASTROS_SECTIONS.map((item) => (
          <Tab
            key={item.id}
            label={item.shortLabel}
            icon={item.icon as React.ReactElement}
            iconPosition="start"
          />
        ))}
      </Tabs>
    );
  }

  // Computador: lista lateral com rótulo e uma descrição curta em text.secondary.
  return (
    <Box
      component="nav"
      aria-label="Seções de cadastro"
      sx={{
        width: 232,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        p: 1,
      }}
    >
      <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {CADASTROS_SECTIONS.map((item) => {
          const selected = item.id === section;
          // Enfermeiro(a): a seção ACS ganha o ícone na cor da marca para ser achada rápido.
          const emphasize = highlightAcs && item.id === 'acs';
          return (
            <ListItemButton
              key={item.id}
              selected={selected}
              aria-current={selected ? 'page' : undefined}
              onClick={() => onChange(item.id)}
              onMouseEnter={() => onSectionHover?.(item.id)}
              sx={{ py: 1, px: 1.25, minHeight: 52, alignItems: 'flex-start' }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 32,
                  mt: '2px',
                  color: selected || emphasize ? 'primary.main' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                sx={{ my: 0 }}
                primary={item.shortLabel}
                secondary={item.description}
                slotProps={{
                  primary: {
                    sx: { fontWeight: selected ? 700 : 600, fontSize: '0.875rem', lineHeight: 1.4 },
                  },
                  secondary: {
                    sx: { fontSize: '0.75rem', lineHeight: 1.35, mt: 0.25, color: 'text.secondary' },
                  },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
