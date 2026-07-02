import {
  Box,
  Card,
  CardContent,
  LinearProgress,
  Typography,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { CheckCircle, RadioButtonUnchecked, TaskAlt } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi, type OperationalChecklist } from '../../services/api';
import { CACHE, queryKeys } from '../../utils/queryKeys';

export function OperationalChecklistCard({ municipalityId }: { municipalityId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.operationalChecklist(municipalityId),
    queryFn: () => dashboardApi.checklist(municipalityId).then((r) => r.data),
    staleTime: CACHE.dashboard,
  });

  if (isLoading || !data) return null;

  return <ChecklistContent checklist={data} />;
}

function ChecklistContent({ checklist }: { checklist: OperationalChecklist }) {
  const theme = useTheme();
  const pendingCritical = checklist.items.filter((i) => !i.done && i.priority === 'critical');

  return (
    <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TaskAlt color="primary" />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>
            Checklist operacional
          </Typography>
          <Chip
            size="small"
            color={checklist.progressPct >= 80 ? 'success' : 'default'}
            label={`${checklist.completed}/${checklist.total}`}
          />
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
          {checklist.items.map((item) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                py: 0.75,
                px: 1,
                borderRadius: 2,
                bgcolor: item.done
                  ? alpha(theme.palette.success.main, 0.06)
                  : alpha(theme.palette.warning.main, 0.04),
              }}
            >
              {item.done ? (
                <CheckCircle color="success" fontSize="small" sx={{ mt: 0.2 }} />
              ) : (
                <RadioButtonUnchecked color="disabled" fontSize="small" sx={{ mt: 0.2 }} />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.detail}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
