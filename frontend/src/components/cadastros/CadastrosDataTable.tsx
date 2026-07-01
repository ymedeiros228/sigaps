import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  alpha,
  useTheme,
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

export function CadastrosDataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  emptyState,
  actions,
}: CadastrosDataTableProps<T>) {
  const theme = useTheme();
  const hasActions = !!actions;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} variant="rounded" height={44} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
    );
  }

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <TableContainer
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        overflow: 'auto',
      }}
    >
      <Table size="medium">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                align={column.align}
                sx={{
                  fontWeight: 700,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  whiteSpace: 'nowrap',
                  display: column.hideOnMobile ? { xs: 'none', sm: 'table-cell' } : undefined,
                  width: column.width,
                }}
              >
                {column.label}
              </TableCell>
            ))}
            {hasActions && (
              <TableCell
                align="right"
                sx={{
                  fontWeight: 700,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  width: 96,
                }}
              >
                Ações
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              hover
              sx={{
                '&:last-child td': { borderBottom: 0 },
                '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.35) },
              }}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  sx={{ display: column.hideOnMobile ? { xs: 'none', sm: 'table-cell' } : undefined }}
                >
                  {column.render(row)}
                </TableCell>
              ))}
              {hasActions && (
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
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
