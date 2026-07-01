import type { ReactNode } from 'react';
import {
  AccountBalance,
  LocalHospital,
  People,
  LocationCity,
  GridView,
} from '@mui/icons-material';

export type CadastrosSectionId = 'municipio' | 'ubs' | 'acs' | 'bairros' | 'microareas';

export type CadastrosSection = {
  id: CadastrosSectionId;
  label: string;
  shortLabel: string;
  description: string;
  icon: ReactNode;
};

export const CADASTROS_SECTIONS: CadastrosSection[] = [
  {
    id: 'municipio',
    label: 'Município',
    shortLabel: 'Município',
    description: 'Identidade e dados institucionais',
    icon: <AccountBalance fontSize="small" />,
  },
  {
    id: 'ubs',
    label: 'Unidades Básicas de Saúde',
    shortLabel: 'UBS',
    description: 'Unidades de referência da APS',
    icon: <LocalHospital fontSize="small" />,
  },
  {
    id: 'acs',
    label: 'Agentes Comunitários',
    shortLabel: 'ACS',
    description: 'Profissionais vinculados às microáreas',
    icon: <People fontSize="small" />,
  },
  {
    id: 'bairros',
    label: 'Bairros',
    shortLabel: 'Bairros',
    description: 'Divisão territorial do município',
    icon: <LocationCity fontSize="small" />,
  },
  {
    id: 'microareas',
    label: 'Microáreas',
    shortLabel: 'Microáreas',
    description: 'Territórios de cobertura e pintura no mapa',
    icon: <GridView fontSize="small" />,
  },
];

export const MICROAREA_COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#009688'];

export function isCadastrosSectionId(value: string | null): value is CadastrosSectionId {
  return CADASTROS_SECTIONS.some((section) => section.id === value);
}
