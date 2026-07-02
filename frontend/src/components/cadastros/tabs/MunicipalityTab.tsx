import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  TextField,
  Typography,
  alpha,
  useTheme,
  Alert,
} from '@mui/material';
import { AccountBalance, CloudUpload, Sync, Upload } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { municipalitiesApi, integrationsApi } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { EsusImportDialog } from '../EsusImportDialog';
import { canImportStreets } from '../../../utils/permissions';
import { useAuthStore } from '../../../store';
import { assetUrl } from '../../../utils/assetUrl';
import { queryKeys } from '../../../utils/queryKeys';

type MunicipalityForm = {
  name: string;
  state: string;
  prefecture: string;
  secretariat: string;
};

export function MunicipalityTab({ municipalityId }: { municipalityId: string }) {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const { canManage, reportError, reportSuccess } = useCadastros();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [esusOpen, setEsusOpen] = useState(false);
  const canImportEsus = canImportStreets(user?.role);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MunicipalityForm>();

  const { data: municipality, isLoading } = useQuery({
    queryKey: ['municipality', municipalityId],
    queryFn: () => municipalitiesApi.get(municipalityId).then((r) => r.data),
  });

  useEffect(() => {
    if (municipality) {
      reset({
        name: municipality.name,
        state: municipality.state,
        prefecture: municipality.prefecture,
        secretariat: municipality.secretariat,
      });
    }
  }, [municipality, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: MunicipalityForm) => municipalitiesApi.update(municipalityId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipality'] });
      reportSuccess('Dados do município atualizados.');
    },
    onError: reportError,
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => municipalitiesApi.uploadLogo(municipalityId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['municipality'] });
      reportSuccess('Logotipo enviado com sucesso.');
    },
    onError: reportError,
  });

  const syncEsusMutation = useMutation({
    mutationFn: () => integrationsApi.syncEsus(municipalityId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['municipality', municipalityId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(municipalityId) });
      if (res.data.ok) {
        reportSuccess(res.data.message);
      } else {
        reportError(new Error(res.data.message));
      }
    },
    onError: reportError,
  });

  if (isLoading || !municipality) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
        Dados do município
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Informações exibidas em relatórios e na identidade do sistema.
      </Typography>

      <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
        <CardContent sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, alignItems: 'center' }}>
          <Box
            sx={{
              width: 96,
              height: 96,
              borderRadius: 2.5,
              border: '1px dashed',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            }}
          >
            {municipality.logoUrl ? (
              <Box
                component="img"
                src={assetUrl(municipality.logoUrl) ?? ''}
                alt="Logo do município"
                sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <AccountBalance sx={{ fontSize: 40, color: 'text.secondary' }} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Logotipo institucional
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              PNG, JPG, WEBP ou SVG. Recomendado: fundo transparente.
            </Typography>
            {canManage && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUpload />}
                onClick={() => fileRef.current?.click()}
                disabled={logoMutation.isPending}
              >
                {logoMutation.isPending ? 'Enviando...' : 'Enviar logotipo'}
              </Button>
            )}
          </Box>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
              e.target.value = '';
            }}
          />
        </CardContent>
      </Card>

      {canImportEsus && (
        <Card variant="outlined" sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Integração e-SUS (piloto)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Importe famílias e habitantes por logradouro a partir de CSV exportado do e-SUS.
              Use &quot;Sincronizar&quot; para reaplicar o último CSV importado (também agendado
              semanalmente quando <code>AUTO_ESUS_SYNC_ENABLED=true</code> no servidor).
            </Typography>
            {municipality.esusLastSyncAt && (
              <Alert severity="info" sx={{ mb: 1.5, py: 0.25 }}>
                Última sincronização:{' '}
                {new Date(municipality.esusLastSyncAt).toLocaleString('pt-BR')}
              </Alert>
            )}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Upload />}
                onClick={() => setEsusOpen(true)}
              >
                Importar CSV e-SUS
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Sync />}
                disabled={syncEsusMutation.isPending}
                onClick={() => syncEsusMutation.mutate()}
              >
                {syncEsusMutation.isPending ? 'Sincronizando…' : 'Sincronizar e-SUS'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Divider sx={{ mb: 3 }} />

      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nome do município"
            {...register('name', { required: 'Informe o nome do município' })}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
            disabled={!canManage}
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 120px' }, gap: 2 }}>
            <TextField
              label="Prefeitura"
              {...register('prefecture', { required: 'Informe a prefeitura' })}
              error={!!errors.prefecture}
              helperText={errors.prefecture?.message}
              fullWidth
              disabled={!canManage}
            />
            <TextField
              label="UF"
              {...register('state', { required: 'UF obrigatória', maxLength: { value: 2, message: 'Use 2 letras' } })}
              error={!!errors.state}
              helperText={errors.state?.message}
              fullWidth
              disabled={!canManage}
              slotProps={{ htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } } }}
            />
          </Box>
          <TextField
            label="Secretaria de Saúde"
            {...register('secretariat', { required: 'Informe a secretaria' })}
            error={!!errors.secretariat}
            helperText={errors.secretariat?.message}
            fullWidth
            disabled={!canManage}
          />
          {canManage && (
            <Box>
              <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Salvando...' : 'Salvar dados'}
              </Button>
            </Box>
          )}
        </Box>
      </form>

      <EsusImportDialog
        open={esusOpen}
        municipalityId={municipalityId}
        onClose={() => setEsusOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['streets'] });
          queryClient.invalidateQueries({ queryKey: ['municipality', municipalityId] });
        }}
      />
    </Box>
  );
}
