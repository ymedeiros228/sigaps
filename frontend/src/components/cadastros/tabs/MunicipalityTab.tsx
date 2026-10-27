import { useEffect, useRef, useState } from 'react';
import { Box, Button, Divider, Skeleton, TextField, Typography } from '@mui/material';
import { AccountBalance, CloudUpload, Sync, Upload } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { municipalitiesApi, integrationsApi } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { EsusImportDialog } from '../EsusImportDialog';
import { accessRole, canImportStreets } from '../../../utils/permissions';
import { useAuthStore } from '../../../store';
import { MunicipalityLogo } from '../../common/MunicipalityLogo';
import { queryKeys } from '../../../utils/queryKeys';
import { cadastrosQueryDefaults } from '../../../utils/cadastrosQuery';
import { invalidateCadastrosCache } from '../../../utils/hydrateCadastrosCache';
import { CadastrosLoadError } from '../CadastrosLoadError';

type MunicipalityForm = {
  name: string;
  state: string;
  prefecture: string;
  secretariat: string;
};

/** Quadro do logotipo: o mesmo tamanho no carregamento e com dados. */
const LOGO_SIZE = 88;

/** Subtítulo de cada bloco do município (h3 abaixo do título da seção). */
function BlockTitle({ children }: { children: string }) {
  return (
    <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
      {children}
    </Typography>
  );
}

const blockButtonsSx = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 1,
  '@media (pointer: coarse)': { '& .MuiButton-root': { minHeight: 44 } },
} as const;

export function MunicipalityTab({ municipalityId }: { municipalityId: string }) {
  const user = useAuthStore((s) => s.user);
  const { canManage, reportError, reportSuccess } = useCadastros();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [esusOpen, setEsusOpen] = useState(false);
  const canImportEsus = canImportStreets(accessRole(user));
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MunicipalityForm>();

  const {
    data: municipality,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.municipality(municipalityId),
    queryFn: () => municipalitiesApi.get(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
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
      invalidateCadastrosCache(queryClient, municipalityId);
      reportSuccess('Dados do município atualizados.');
    },
    onError: reportError,
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => municipalitiesApi.uploadLogo(municipalityId, file),
    onSuccess: () => {
      invalidateCadastrosCache(queryClient, municipalityId);
      reportSuccess('Logotipo enviado com sucesso.');
    },
    onError: reportError,
  });

  const syncEsusMutation = useMutation({
    mutationFn: () => integrationsApi.syncEsus(municipalityId),
    onSuccess: (res) => {
      invalidateCadastrosCache(queryClient, municipalityId);
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(municipalityId) });
      if (res.data.ok) {
        reportSuccess(res.data.message);
      } else {
        reportError(new Error(res.data.message));
      }
    },
    onError: reportError,
  });

  if (isError) {
    return (
      <CadastrosLoadError
        title="Erro ao carregar município"
        message={error instanceof Error ? error.message : 'Tente novamente.'}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isPending && !municipality) {
    return (
      <Box sx={{ maxWidth: 640 }} aria-busy="true" aria-label="Carregando dados do município">
        <Skeleton width="45%" height={32} sx={{ mb: 1 }} />
        <Skeleton width="70%" height={20} sx={{ mb: 3 }} />
        <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', mb: 3 }}>
          <Skeleton variant="rounded" width={LOGO_SIZE} height={LOGO_SIZE} sx={{ flexShrink: 0, borderRadius: 1 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="50%" height={22} />
            <Skeleton width="80%" height={18} sx={{ mt: 1 }} />
            <Skeleton variant="rounded" width={140} height={32} sx={{ mt: 1.5, borderRadius: '10px' }} />
          </Box>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rounded" height={56} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 120px' }, gap: 2 }}>
            <Skeleton variant="rounded" height={56} />
            <Skeleton variant="rounded" height={56} />
          </Box>
          <Skeleton variant="rounded" height={56} />
        </Box>
      </Box>
    );
  }

  if (!municipality) return null;

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography variant="h6" component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Dados do município
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Informações exibidas em relatórios e na identidade do sistema.
      </Typography>

      {/* Blocos separados por linhas finas, sem cartão dentro do cartão da página. */}
      <Box component="section" sx={{ display: 'flex', gap: 2.5, alignItems: 'center', mb: 3 }}>
        <Box
          sx={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            flexShrink: 0,
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          {municipality.logoUrl ? (
            <MunicipalityLogo
              logoUrl={municipality.logoUrl}
              alt="Logo do município"
              boxProps={{
                sx: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
              }}
            />
          ) : (
            <AccountBalance sx={{ fontSize: 36, color: 'text.secondary' }} />
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <BlockTitle>Logotipo institucional</BlockTitle>
          <Typography variant="body2" color="text.secondary" sx={{ mb: canManage ? 1.5 : 0 }}>
            PNG, JPG, WEBP ou SVG. Recomendado: fundo transparente.
          </Typography>
          {canManage && (
            <Box sx={blockButtonsSx}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<CloudUpload />}
                onClick={() => fileRef.current?.click()}
                disabled={logoMutation.isPending}
              >
                {logoMutation.isPending ? 'Enviando...' : 'Enviar logotipo'}
              </Button>
            </Box>
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
      </Box>

      {canImportEsus && (
        <>
          <Divider sx={{ mb: 3 }} />
          <Box component="section" sx={{ mb: 3 }}>
            <BlockTitle>Integração e-SUS (piloto)</BlockTitle>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, textWrap: 'pretty' }}>
              Importe famílias e habitantes por logradouro a partir do CSV exportado do e-SUS.
              &quot;Sincronizar&quot; reaplica o último CSV importado. A sincronização automática
              semanal acontece quando estiver ativada no servidor.
            </Typography>
            {municipality.esusLastSyncAt && (
              <Typography
                variant="body2"
                sx={{
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                <Sync fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />
                Última sincronização:{' '}
                {new Date(municipality.esusLastSyncAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </Typography>
            )}
            <Box sx={blockButtonsSx}>
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
          </Box>
        </>
      )}

      <Divider sx={{ mb: 3 }} />

      <form onSubmit={handleSubmit((values) => saveMutation.mutate(values))}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <BlockTitle>Dados institucionais</BlockTitle>
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
              {...register('prefecture', { required: 'Informe o nome da prefeitura' })}
              error={!!errors.prefecture}
              helperText={errors.prefecture?.message}
              fullWidth
              disabled={!canManage}
            />
            <TextField
              label="UF"
              {...register('state', {
                required: 'Informe a UF com 2 letras (ex.: MA)',
                maxLength: { value: 2, message: 'Use só a sigla, com 2 letras (ex.: MA)' },
              })}
              error={!!errors.state}
              helperText={errors.state?.message}
              fullWidth
              disabled={!canManage}
              slotProps={{ htmlInput: { maxLength: 2, style: { textTransform: 'uppercase' } } }}
            />
          </Box>
          <TextField
            label="Secretaria de Saúde"
            {...register('secretariat', { required: 'Informe o nome da Secretaria de Saúde' })}
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
        onSuccess={(message) => {
          invalidateCadastrosCache(queryClient, municipalityId);
          queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(municipalityId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.operationalChecklist(municipalityId) });
          queryClient.invalidateQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
          reportSuccess(message);
        }}
      />
    </Box>
  );
}
