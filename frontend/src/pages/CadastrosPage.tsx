import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { Add, Delete, Edit } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ubsApi,
  acsApi,
  neighborhoodsApi,
  microareasApi,
  type Ubs,
  type Acs,
  type Neighborhood,
  type Microarea,
} from '../services/api';
import { useMunicipalityId } from '../hooks/useMunicipalityId';

const MICROAREA_COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#009688'];

function UbsTab({ municipalityId }: { municipalityId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ubs | null>(null);
  const { register, handleSubmit, reset } = useForm<Omit<Ubs, 'id' | '_count'>>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values: Omit<Ubs, 'id' | '_count'>) =>
      editing
        ? ubsApi.update(editing.id, values)
        : ubsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ubs'] });
      setOpen(false);
      setEditing(null);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ubsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ubs'] }),
  });

  const openForm = (item?: Ubs) => {
    setEditing(item ?? null);
    reset(
      item ?? {
        name: '',
        address: '',
        phone: '',
        coordinator: '',
        latitude: -6.1828,
        longitude: -43.7869,
      },
    );
    setOpen(true);
  };

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Unidades Básicas de Saúde</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={() => openForm()}>
          Nova UBS
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell>Endereço</TableCell>
            <TableCell>Telefone</TableCell>
            <TableCell>Microáreas</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.address}</TableCell>
              <TableCell>{row.phone ?? '—'}</TableCell>
              <TableCell>{row._count?.microareas ?? 0}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => openForm(row)}>
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(row.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar UBS' : 'Nova UBS'}</DialogTitle>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Nome" {...register('name', { required: true })} fullWidth />
            <TextField label="Endereço" {...register('address', { required: true })} fullWidth />
            <TextField label="Telefone" {...register('phone')} fullWidth />
            <TextField label="Coordenador" {...register('coordinator')} fullWidth />
            <TextField label="Latitude" type="number" slotProps={{ htmlInput: { step: 0.0001 } }} {...register('latitude', { valueAsNumber: true })} fullWidth />
            <TextField label="Longitude" type="number" slotProps={{ htmlInput: { step: 0.0001 } }} {...register('longitude', { valueAsNumber: true })} fullWidth />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              Salvar
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function AcsTab({ municipalityId }: { municipalityId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acs | null>(null);
  const { register, handleSubmit, reset } = useForm<{ name: string; cpf: string; phone?: string; status: string }>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['acs', municipalityId],
    queryFn: () => acsApi.list(municipalityId).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values: { name: string; cpf: string; phone?: string; status: string }) =>
      editing
        ? acsApi.update(editing.id, values)
        : acsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acs'] });
      setOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => acsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['acs'] }),
  });

  const openForm = (item?: Acs) => {
    setEditing(item ?? null);
    reset(item ?? { name: '', cpf: '', phone: '', status: 'ATIVO' });
    setOpen(true);
  };

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Agentes Comunitários de Saúde</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={() => openForm()}>
          Novo ACS
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell>CPF</TableCell>
            <TableCell>Telefone</TableCell>
            <TableCell>Microárea</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**')}</TableCell>
              <TableCell>{row.phone ?? '—'}</TableCell>
              <TableCell>
                {row.microarea ? (
                  <Chip label={row.microarea.name} size="small" sx={{ bgcolor: row.microarea.color, color: '#fff' }} />
                ) : '—'}
              </TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => openForm(row)}>
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(row.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar ACS' : 'Novo ACS'}</DialogTitle>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Nome" {...register('name', { required: true })} fullWidth />
            <TextField label="CPF (11 dígitos)" {...register('cpf', { required: true, minLength: 11, maxLength: 11 })} fullWidth disabled={!!editing} />
            <TextField label="Telefone" {...register('phone')} fullWidth />
            <TextField label="Status" select {...register('status')} fullWidth defaultValue="ATIVO">
              <MenuItem value="ATIVO">Ativo</MenuItem>
              <MenuItem value="INATIVO">Inativo</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function NeighborhoodsTab({ municipalityId }: { municipalityId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Neighborhood | null>(null);
  const { register, handleSubmit, reset } = useForm<{ name: string }>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['neighborhoods', municipalityId],
    queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values: { name: string }) =>
      editing
        ? neighborhoodsApi.update(editing.id, values)
        : neighborhoodsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      setOpen(false);
      reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => neighborhoodsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['neighborhoods'] }),
  });

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Bairros</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={() => { setEditing(null); reset({ name: '' }); setOpen(true); }}>
          Novo Bairro
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nome</TableCell>
            <TableCell>Ruas vinculadas</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row._count?.streets ?? 0}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => { setEditing(row); reset({ name: row.name }); setOpen(true); }}>
                  <Edit fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(row.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing ? 'Editar Bairro' : 'Novo Bairro'}</DialogTitle>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogContent>
            <TextField label="Nome" {...register('name', { required: true })} fullWidth />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

function MicroareasTab({ municipalityId }: { municipalityId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Microarea | null>(null);
  const { register, handleSubmit, reset } = useForm<{ number: number; name: string; color: string; description?: string; ubsId?: string; acsId?: string }>();

  const { data: ubsList = [] } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
  });

  const { data: acsList = [] } = useQuery({
    queryKey: ['acs', municipalityId],
    queryFn: () => acsApi.list(municipalityId).then((r) => r.data),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ['microareas', municipalityId],
    queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (values: { number: number; name: string; color: string; description?: string; ubsId?: string; acsId?: string }) =>
      editing
        ? microareasApi.update(editing.id, values)
        : microareasApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microareas'] });
      setOpen(false);
      reset();
    },
  });

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">Microáreas</Typography>
        <Button startIcon={<Add />} variant="contained" onClick={() => {
          setEditing(null);
          reset({ number: data.length + 1, name: `Microárea ${String(data.length + 1).padStart(2, '0')}`, color: MICROAREA_COLORS[data.length % MICROAREA_COLORS.length] });
          setOpen(true);
        }}>
          Nova Microárea
        </Button>
      </Box>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Nº</TableCell>
            <TableCell>Nome</TableCell>
            <TableCell>Cor</TableCell>
            <TableCell>UBS</TableCell>
            <TableCell>ACS</TableCell>
            <TableCell>Ruas</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.number}</TableCell>
              <TableCell>{row.name}</TableCell>
              <TableCell>
                <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: row.color }} />
              </TableCell>
              <TableCell>{row.ubs?.name ?? '—'}</TableCell>
              <TableCell>{row.acs?.name ?? '—'}</TableCell>
              <TableCell>{row._count?.streets ?? 0}</TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => {
                  setEditing(row);
                  reset({ number: row.number, name: row.name, color: row.color, description: row.description, ubsId: row.ubsId, acsId: row.acsId });
                  setOpen(true);
                }}>
                  <Edit fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar Microárea' : 'Nova Microárea'}</DialogTitle>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Número" type="number" {...register('number', { valueAsNumber: true, required: true })} fullWidth />
            <TextField label="Nome" {...register('name', { required: true })} fullWidth />
            <TextField label="Cor (#hex)" {...register('color', { required: true })} fullWidth />
            <TextField label="Descrição" {...register('description')} fullWidth multiline rows={2} />
            <TextField label="UBS" select {...register('ubsId')} fullWidth defaultValue="">
              <MenuItem value="">Nenhuma</MenuItem>
              {ubsList.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="ACS" select {...register('acsId')} fullWidth defaultValue="">
              <MenuItem value="">Nenhum</MenuItem>
              {acsList.map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}

export function CadastrosPage() {
  const municipalityId = useMunicipalityId();
  const [tab, setTab] = useState(0);

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Cadastros</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        UBS, ACS, Bairros e Microáreas — Passagem Franca/MA
      </Typography>

      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable">
          <Tab label="UBS" />
          <Tab label="ACS" />
          <Tab label="Bairros" />
          <Tab label="Microáreas" />
        </Tabs>
        <CardContent>
          {tab === 0 && <UbsTab municipalityId={municipalityId} />}
          {tab === 1 && <AcsTab municipalityId={municipalityId} />}
          {tab === 2 && <NeighborhoodsTab municipalityId={municipalityId} />}
          {tab === 3 && <MicroareasTab municipalityId={municipalityId} />}
        </CardContent>
      </Card>
    </Box>
  );
}
