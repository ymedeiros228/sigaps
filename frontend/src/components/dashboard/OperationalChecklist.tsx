import {
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Typography,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { CheckCircle, Download, OpenInNew, RadioButtonUnchecked, TaskAlt } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { useState } from 'react';
import { dashboardApi, type OperationalChecklist } from '../../services/api';
import { CACHE, queryKeys } from '../../utils/queryKeys';

export function OperationalChecklistCard({ municipalityId }: { municipalityId: string }) {
  const [csvLoading, setCsvLoading] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.operationalChecklist(municipalityId),
    queryFn: () => dashboardApi.checklist(municipalityId).then((r) => r.data),
    staleTime: CACHE.dashboard,
  });

  const downloadCsv = async () => {
    setCsvLoading(true);
    try {
      const { data: blob } = await dashboardApi.checklistCsv(municipalityId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sigaps-checklist.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvLoading(false);
    }
  };

  if (isLoading || !data) return null;

  return <ChecklistContent checklist={data} onExportCsv={downloadCsv} csvLoading={csvLoading} />;
}

function checklistItemHref(item: OperationalChecklist['items'][number]): string | undefined {
  if (!item.actionHref) return undefined;
  if (item.id === 'families' && item.done) return item.actionHref;
  if (!item.done) return item.actionHref;
  return undefined;
}

function ChecklistContent({
  checklist,
  onExportCsv,
  csvLoading,
}: {
  checklist: OperationalChecklist;
  onExportCsv: () => void;
  csvLoading: boolean;
}) {
  const theme = useTheme();
  const pendingCritical = checklist.items.filter((i) => !i.done && i.priority === 'critical');

  return (
    <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <TaskAlt color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>
            Checklist operacional
          </Typography>
          {checklist.readyForHomologation && (
            <Chip size="small" color="success" label="Pronto p/ homologação" />
          )}
          {checklist.readyForPainting && !checklist.readyForHomologation && (
            <Chip size="small" color="info" label="Pronto para pintar" />
          )}
          <Chip
            size="small"
            color={checklist.progressPct >= 80 ? 'success' : 'default'}
            label={`${checklist.completed}/${checklist.total}`}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download />}
            disabled={csvLoading}
            onClick={onExportCsv}
          >
            CSV
          </Button>
        </Box>

        <LinearProgress
          variant="determinate"
          value={checklist.progressPct}
          sx={{ mb: 2, height: 8, borderRadius: 4 }}
        />

        {pendingCritical.length > 0 && (
          <Typography variant="body2" color="warning.main" sx={{ mb: 1.5 }}>
            {pendingCritical.length} item(ns) crítico(s) pendente(s) para operação plena da APS.
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {checklist.items.map((item) => {
            const href = checklistItemHref(item);
            return (
            <Box
              key={item.id}
              component={href ? RouterLink : 'div'}
              to={href}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                py: 0.75,
                px: 1,
                borderRadius: 2,
                textDecoration: 'none',
                color: 'inherit',
                bgcolor: item.done
                  ? alpha(theme.palette.success.main, 0.06)
                  : alpha(theme.palette.warning.main, 0.04),
                ...(href
                  ? {
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      },
                    }
                  : {}),
              }}
            >
              {item.done ? (
                <CheckCircle color="success" fontSize="small" sx={{ mt: 0.2 }} />
              ) : (
                <RadioButtonUnchecked color="disabled" fontSize="small" sx={{ mt: 0.2 }} />
              )}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.detail}
                </Typography>
              </Box>
              {href && (
                <OpenInNew fontSize="small" color="action" sx={{ mt: 0.3, opacity: 0.6 }} />
              )}
            </Box>
          );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
