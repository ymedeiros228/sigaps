import { useEffect } from 'react';
import {
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
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import type { Acs, Microarea } from '../../../services/api';
import {
  digitsOnly,
  formatCpf,
  formatPhone,
  isValidCpf,
} from '../../../utils/inputMasks';

export type AcsFormValues = {
  name: string;
  cpf: string;
  phone: string;
  status: string;
  microareaId: string;
};

interface AcsFormDialogProps {
  open: boolean;
  editing: Acs | null;
  microareas: Microarea[];
  loading: boolean;
  onClose: () => void;
  onSave: (values: AcsFormValues, andAnother: boolean) => void;
}

const emptyValues: AcsFormValues = {
  name: '',
  cpf: '',
  phone: '',
  status: 'ATIVO',
  microareaId: '',
};

export function AcsFormDialog({
  open,
  editing,
  microareas,
  loading,
  onClose,
  onSave,
}: AcsFormDialogProps) {
  const {
    register,
    control,
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
            cpf: digitsOnly(editing.cpf),
            phone: editing.phone ?? '',
            status: editing.status,
            microareaId: editing.microarea?.id ?? '',
          }
        : emptyValues,
    );
  }, [open, editing, reset]);

  const microareaOptions = microareas.filter((m) => {
    if (!m.acsId) return true;
    return editing && m.acsId === editing.id;
  });

  const submit = (andAnother: boolean) =>
    handleSubmit((values) =>
      onSave(
        {
          ...values,
          cpf: digitsOnly(values.cpf),
          phone: digitsOnly(values.phone) || '',
        },
        andAnother,
      ),
    );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {editing ? 'Editar ACS' : 'Cadastrar ACS'}
      </DialogTitle>
      <form onSubmit={submit(false)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {!editing && (
            <Typography variant="body2" color="text.secondary">
              Preencha os dados do agente. Você pode vincular a microárea agora ou depois, na aba
              Microáreas.
            </Typography>
          )}

          <TextField
            label="Nome completo"
            autoFocus
            {...register('name', { required: 'Informe o nome' })}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
          />

          <Controller
            name="cpf"
            control={control}
            rules={{
              required: 'Informe o CPF',
              validate: (v) => {
                const d = digitsOnly(v);
                if (d.length !== 11) return 'CPF deve ter 11 dígitos';
                if (!isValidCpf(d)) return 'CPF inválido';
                return true;
              },
            }}
            render={({ field }) => (
              <TextField
                label="CPF"
                value={formatCpf(field.value)}
                onChange={(e) => field.onChange(digitsOnly(e.target.value).slice(0, 11))}
                error={!!errors.cpf}
                helperText={errors.cpf?.message}
                fullWidth
                disabled={!!editing}
                placeholder="000.000.000-00"
              />
            )}
          />

          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <TextField
                label="Telefone / WhatsApp"
                value={formatPhone(field.value)}
                onChange={(e) => field.onChange(digitsOnly(e.target.value).slice(0, 11))}
                fullWidth
                placeholder="(00) 00000-0000"
              />
            )}
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
