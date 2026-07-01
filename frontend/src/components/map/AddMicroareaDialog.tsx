import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  CircularProgress,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { microareasApi, type Microarea } from '../../services/api';
import { MICROAREA_COLORS } from '../cadastros/cadastrosConfig';

interface AddMicroareaDialogProps {
  open: boolean;
  onClose: () => void;
  municipalityId: string;
  existingCount: number;
  onCreated: (microarea: Microarea) => void;
}

type Form = { name: string; color: string; number: number };

export function AddMicroareaDialog({
  open,
  onClose,
  municipalityId,
  existingCount,
  onCreated,
}: AddMicroareaDialogProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Form>();

  useEffect(() => {
    if (!open) return;
    reset({
      number: existingCount + 1,
      name: `Microárea ${String(existingCount + 1).padStart(2, '0')}`,
      color: MICROAREA_COLORS[existingCount % MICROAREA_COLORS.length],
    });
  }, [open, existingCount, reset]);

  const color = watch('color') || MICROAREA_COLORS[0];

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      microareasApi.create({ ...values, municipalityId }).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['microareas'] });
      onCreated(data);
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Add color="primary" />
        Nova microárea
      </DialogTitle>
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            label="Número"
            type="number"
            {...register('number', { required: true, valueAsNumber: true, min: 1 })}
            error={!!errors.number}
          />
          <TextField
            label="Nome"
            {...register('name', { required: 'Informe o nome' })}
            error={!!errors.name}
            helperText={errors.name?.message}
          />
          <Box>
            <Box sx={{ typography: 'caption', color: 'text.secondary', mb: 1 }}>Cor no mapa</Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {MICROAREA_COLORS.map((c) => (
                <Box
                  key={c}
                  onClick={() => setValue('color', c)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1.5,
                    bgcolor: c,
                    cursor: 'pointer',
                    border: color === c ? '3px solid #fff' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                  }}
                />
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={mutation.isPending}>Cancelar</Button>
          <Button
            type="submit"
            variant="contained"
            disabled={mutation.isPending}
            startIcon={mutation.isPending ? <CircularProgress size={18} color="inherit" /> : <Add />}
          >
            {mutation.isPending ? 'Salvando...' : 'Adicionar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
