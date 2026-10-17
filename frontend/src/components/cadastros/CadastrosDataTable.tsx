import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import type { ReactNode } from 'react';

export type CadastrosColumn<T> = {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  width?: string | number;
  hideOnMobile?: boolean;
  render: (row: T) => ReactNode;
};

type CadastrosDataTableProps<T> = {
  columns: CadastrosColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState: ReactNode;
  actions?: (row: T) => ReactNode;
};

const SKELETON_ROWS = 5;

/** Cabeçalho legível: sem caixa alta, cinza de apoio, fundo neutro (o verde fica para ação). */
const headCellSx = {
  fontWeight: 600,
  fontSize: '0.8125rem',
  color: 'text.secondary',
  bgcolor: 'action.hover',
  whiteSpace: 'nowrap',
  py: 1.25,
};

/** Botões de ação com alvo de toque ≥ 44 px quando o ponteiro é o dedo. */
const actionsCellSx = {
  whiteSpace: 'nowrap',
  py: 0.75,
  '@media (pointer: coarse)': {
    '& .MuiIconButton-root': { width: 44, height: 44 },
  },
};

function hideOnMobileSx(hide?: boolean) {
  return hide ? { xs: 'none', sm: 'table-cell' } : undefined;
}

export function CadastrosDataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  actions,
}: CadastrosDataTableProps<T>) {
  const hasActions = !!actions;

  if (!loading && rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <TableContainer
      aria-busy={loading || undefined}
      sx={{
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
        overflow: 'auto',
      }}
    >
      {/* tabular-nums: contagens, coordenadas e números alinham na vertical */}
      <Table size="medium" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                sx={{ ...headCellSx, display: hideOnMobileSx(column.hideOnMobile), width: column.width }}
              >
                {column.label}
              </TableCell>
            ))}
            {hasActions && (
              <TableCell align="right" sx={{ ...headCellSx, width: 96 }}>
                Ações
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading
            ? // Carregando: o mesmo esqueleto da tabela, para a tela não "pular" quando os dados chegam.
              Array.from({ length: SKELETON_ROWS }).map((_, index) => (
                <TableRow key={index} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  {columns.map((column, colIndex) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      sx={{ display: hideOnMobileSx(column.hideOnMobile) }}
                    >
                      <Skeleton
                        width={colIndex === 0 ? '70%' : column.align === 'center' ? 24 : '55%'}
                        sx={{ display: 'inline-block' }}
                      />
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell align="right">
                      <Skeleton variant="circular" width={28} height={28} sx={{ display: 'inline-block' }} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            : rows.map((row) => (
                <TableRow key={rowKey(row)} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      align={column.align}
                      sx={{ display: hideOnMobileSx(column.hideOnMobile), py: 1.5 }}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {hasActions && (
                    <TableCell align="right" sx={actionsCellSx}>
                      {actions(row)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
