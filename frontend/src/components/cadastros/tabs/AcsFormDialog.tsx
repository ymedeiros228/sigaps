import { useEffect, useRef } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { CloudUpload, Person } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import type { Acs, Microarea } from '../../../services/api';
import { assetUrl } from '../../../utils/assetUrl';
import { sortMicroareas } from '../../../utils/sortMicroareas';

export type AcsFormValues = {
  name: string;
  status: string;
  microareaId: string;
  streetCoverageText: string;
};

interface AcsFormDialogProps {
  open: boolean;
  editing: Acs | null;
  microareas: Microarea[];
  loading: boolean;
  photoLoading?: boolean;
  onClose: () => void;
  onSave: (values: AcsFormValues, andAnother: boolean) => void;
  onPhotoUpload?: (file: File) => void;
}

const emptyValues: AcsFormValues = {
  name: '',
  status: 'ATIVO',
  microareaId: '',
  streetCoverageText: '',
};

export function AcsFormDialog({
  open,
  editing,
  microareas,
  loading,
  photoLoading,
  onClose,
  onSave,
  onPhotoUpload,
}: AcsFormDialogProps) {
  const theme = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AcsFormValues>();

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            name: editing.name,
            status: editing.status,
            microareaId: editing.microarea?.id ?? '',
            streetCoverageText: editing.streetCoverageText ?? '',
          }
        : emptyValues,
    );
  }, [open, editing, reset]);

  const microareaOptions = sortMicroareas(
    microareas.filter((m) => {
      if (!m.acsId) return true;
      return editing && m.acsId === editing.id;
    }),
  );

  const submit = (andAnother: boolean) =>
    handleSubmit((values) => onSave(values, andAnother));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {editing ? 'Editar ACS' : 'Cadastrar ACS'}
      </DialogTitle>
      <form onSubmit={submit(false)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary">
            {editing
              ? 'Atualize o nome, status ou microárea do agente.'
              : 'Informe o nome do agente. Você pode vincular a microárea agora ou depois, na aba Microáreas.'}
          </Typography>

          {editing && onPhotoUpload && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar
                src={assetUrl(editing.photoUrl) ?? undefined}
                sx={{
                  width: 72,
                  height: 72,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  border: 2,
                  borderColor: 'divider',
                }}
              >
                <Person />
              </Avatar>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Foto do ACS
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  PNG, JPG ou WEBP. Aparece no cartão do agente.
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={photoLoading ? <CircularProgress size={14} /> : <CloudUpload />}
                  disabled={photoLoading}
                  onClick={() => fileRef.current?.click()}
                >
                  {editing.photoUrl ? 'Trocar foto' : 'Enviar foto'}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPhotoUpload(file);
                    e.target.value = '';
                  }}
                />
              </Box>
            </Box>
          )}

          <TextField
            label="Nome completo"
            autoFocus
            {...register('name', { required: 'Informe o nome' })}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
          />

          <TextField label="Status" select {...register('status')} fullWidth defaultValue="ATIVO">
            <MenuItem value="ATIVO">Ativo</MenuItem>
            <MenuItem value="INATIVO">Inativo</MenuItem>
          </TextField>

          <TextField
            label="Microárea"
            select
            {...register('microareaId')}
            fullWidth
            helperText="Opcional — vincula o ACS à microárea escolhida"
          >
            <MenuItem value="">Sem microárea</MenuItem>
            {microareaOptions.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={m.number}
                    size="small"
                    sx={{ bgcolor: m.color, color: '#fff', minWidth: 28, height: 22 }}
                  />
                  {m.name}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Ruas / trechos atendidos"
            {...register('streetCoverageText')}
            fullWidth
            multiline
            minRows={3}
            helperText="Opcional — use uma rua por linha ou separe por ponto e vírgula. Com microárea vinculada, o sistema tenta pintar automaticamente."
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Box sx={{ flex: 1 }} />
          {!editing && (
            <Button
              variant="outlined"
              disabled={loading}
              onClick={submit(true)}
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              Salvar e cadastrar outro
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Salvando…' : editing ? 'Salvar alterações' : 'Salvar ACS'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
