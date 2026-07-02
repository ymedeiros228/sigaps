import { Box, Chip, MenuItem, TextField, Typography } from '@mui/material';
import type { UseFormRegister } from 'react-hook-form';
import type { Acs, Microarea, Neighborhood, Ubs } from '../../services/api';

export type MicroareaLinkForm = {
  ubsId?: string;
  acsId?: string;
  neighborhoodId?: string;
};

type MicroareaLinkFieldsProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  ubsList: Ubs[];
  acsList: Acs[];
  neighborhoods: Neighborhood[];
  editingMicroareaId?: string;
  microareas: Microarea[];
};

export function MicroareaLinkFields({
  register,
  ubsList,
  acsList,
  neighborhoods,
  editingMicroareaId,
  microareas,
}: MicroareaLinkFieldsProps) {
  const availableAcs = acsList.filter((acs) => {
    const linked = microareas.find((m) => m.acsId === acs.id);
    if (!linked) return true;
    return linked.id === editingMicroareaId;
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Vincule a um ACS já cadastrado, à UBS de referência e ao bairro que centraliza o território
        no mapa.
      </Typography>

      <TextField
        label="ACS responsável"
        select
        {...register('acsId')}
        fullWidth
        defaultValue=""
        helperText={
          availableAcs.length === 0
            ? 'Cadastre ACS em Cadastros → ACS antes de vincular'
            : 'Cada ACS pode estar em apenas uma microárea'
        }
      >
        <MenuItem value="">Nenhum</MenuItem>
        {availableAcs.map((acs) => (
          <MenuItem key={acs.id} value={acs.id}>
            {acs.name}
            {acs.phone ? ` — ${acs.phone}` : ''}
          </MenuItem>
        ))}
      </TextField>

      <TextField label="UBS de referência" select {...register('ubsId')} fullWidth defaultValue="">
        <MenuItem value="">Nenhuma</MenuItem>
        {ubsList.map((ubs) => (
          <MenuItem key={ubs.id} value={ubs.id}>
            {ubs.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Bairro (centralizador no mapa)"
        select
        {...register('neighborhoodId')}
        fullWidth
        defaultValue=""
        helperText="Ao selecionar a microárea no mapa, o zoom irá para as ruas deste bairro"
      >
        <MenuItem value="">Nenhum</MenuItem>
        {neighborhoods.map((n) => (
          <MenuItem key={n.id} value={n.id}>
            {n.name}
            {n._count?.streets != null ? ` (${n._count.streets} ruas)` : ''}
          </MenuItem>
        ))}
      </TextField>

      {neighborhoods.length === 0 && (
        <Chip
          size="small"
          label="Cadastre bairros em Cadastros → Bairros"
          variant="outlined"
          color="warning"
        />
      )}
    </Box>
  );
}
