import type React from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tab,
  Tabs,
  Typography,
  alpha,
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

  if (isMobile) {
    return (
      <Tabs
        value={sectionIndex}
        onChange={(_, index) => onChange(CADASTROS_SECTIONS[index].id)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 48,
          '& .MuiTab-root': { minHeight: 48, gap: 0.75 },
        }}
      >
        {CADASTROS_SECTIONS.map((item) => (
          <Tab key={item.id} label={item.shortLabel} icon={item.icon as React.ReactElement} iconPosition="start" />
        ))}
      </Tabs>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        width: 240,
        flexShrink: 0,
        borderRight: 1,
        borderColor: 'divider',
        py: 1.5,
        px: 1,
      }}
    >
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 1.5, mb: 1, display: 'block', letterSpacing: 1.2 }}
      >
        Seções
      </Typography>
      <List disablePadding>
        {CADASTROS_SECTIONS.map((item) => {
          const selected = item.id === section;
          const emphasize = highlightAcs && item.id === 'acs' && !selected;
          return (
            <ListItemButton
              key={item.id}
              selected={selected}
              onClick={() => onChange(item.id)}
              onMouseEnter={() => onSectionHover?.(item.id)}
              sx={{
                py: 1.25,
                mb: 0.5,
                alignItems: 'flex-start',
                ...(emphasize && {
                  borderLeft: 3,
                  borderColor: 'success.main',
                  bgcolor: alpha(theme.palette.success.main, 0.06),
                }),
                '&.Mui-selected': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  mt: 0.25,
                  color: selected ? 'primary.main' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.shortLabel}
                secondary={item.description}
                slotProps={{
                  primary: { sx: { fontWeight: selected ? 700 : 600, fontSize: '0.9rem' } },
                  secondary: { sx: { fontSize: '0.72rem', lineHeight: 1.35, mt: 0.25 } },
                }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
