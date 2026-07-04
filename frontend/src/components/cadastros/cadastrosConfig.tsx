import type { ReactNode } from 'react';
import {
  AccountBalance,
  LocalHospital,
  People,
  LocationCity,
  GridView,
  HomeWork,
} from '@mui/icons-material';

export type CadastrosSectionId = 'municipio' | 'ubs' | 'acs' | 'bairros' | 'povoados' | 'microareas';

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
    description: 'UBS de referência — planilha Excel ou marcação no mapa',
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
    id: 'povoados',
    label: 'Povoados e localidades',
    shortLabel: 'Povoados',
    description: 'Povoados no mapa — busca, satélite ou coordenadas manuais',
    icon: <HomeWork fontSize="small" />,
  },
  {
    id: 'microareas',
    label: 'Microáreas',
    shortLabel: 'Microáreas',
    description: 'Territórios de cobertura e pintura no mapa',
    icon: <GridView fontSize="small" />,
  },
];

/**
 * Paleta de alto contraste — cores vizinhas na sequência são propositalmente
 * muito diferentes entre si (matiz e luminosidade) para facilitar a leitura
 * do mapa. Evita tons próximos como dois verdes ou amarelo/laranja seguidos.
 */
export const MICROAREA_COLORS = [
  '#E6194B', // vermelho
  '#4363D8', // azul
  '#3CB44B', // verde
  '#FFE119', // amarelo
  '#911EB4', // roxo
  '#F58231', // laranja
  '#42D4F4', // ciano claro
  '#F032E6', // magenta
  '#9A6324', // marrom
  '#000075', // azul-marinho
  '#808000', // oliva
  '#469990', // verde-petróleo escuro
];

export function isCadastrosSectionId(value: string | null): value is CadastrosSectionId {
  return CADASTROS_SECTIONS.some((section) => section.id === value);
}
