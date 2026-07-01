import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
  TableContainer,
  alpha,
  useTheme,
  Alert,
} from '@mui/material';
import { Add, Delete, Edit, LocalHospital, People, LocationCity, GridView, AccountBalance } from '@mui/icons-material';
import { PageHeader } from '../components/ui/PageHeader';
import { CadastrosProvider, useCadastros } from '../components/cadastros/CadastrosContext';
import { useAuthStore } from '../store';
import { canManageCadastros } from '../utils/permissions';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  ubsApi,
  acsApi,
  neighborhoodsApi,
  microareasApi,
  municipalitiesApi,
  type Ubs,
  type Acs,
  type Neighborhood,
  type Microarea,
} from '../services/api';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { assetUrl } from '../utils/assetUrl';

const MICROAREA_COLORS = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#009688'];

function UbsTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError, confirmDelete } = useCadastros();
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
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ubsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ubs'] }),
    onError: reportError,
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
      <TabToolbar title="Unidades Básicas de Saúde" onAdd={() => openForm()} addLabel="Nova UBS" canManage={canManage} />
      <TableContainer>
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
                {canManage && (
                  <>
                    <IconButton size="small" onClick={() => openForm(row)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => confirmDelete(row.name, () => deleteMutation.mutate(row.id))}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableContainer>

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
  const { canManage, reportError, confirmDelete } = useCadastros();
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
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => acsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['acs'] }),
    onError: reportError,
  });

  const openForm = (item?: Acs) => {
    setEditing(item ?? null);
    reset(item ?? { name: '', cpf: '', phone: '', status: 'ATIVO' });
    setOpen(true);
  };

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <TabToolbar title="Agentes Comunitários de Saúde" onAdd={() => openForm()} addLabel="Novo ACS" canManage={canManage} />
      <TableContainer>
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
                {canManage && (
                  <>
                    <IconButton size="small" onClick={() => openForm(row)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => confirmDelete(row.name, () => deleteMutation.mutate(row.id))}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableContainer>

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
  const { canManage, reportError, confirmDelete } = useCadastros();
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
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => neighborhoodsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['neighborhoods'] }),
    onError: reportError,
  });

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <TabToolbar
        title="Bairros"
        onAdd={() => { setEditing(null); reset({ name: '' }); setOpen(true); }}
        addLabel="Novo Bairro"
        canManage={canManage}
      />
      <TableContainer>
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
                {canManage && (
                  <>
                    <IconButton size="small" onClick={() => { setEditing(row); reset({ name: row.name }); setOpen(true); }}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => confirmDelete(row.name, () => deleteMutation.mutate(row.id))}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableContainer>

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
  const { canManage, reportError } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Microarea | null>(null);
  const { register, handleSubmit, reset, watch, setValue } = useForm<{ number: number; name: string; color: string; description?: string; ubsId?: string; acsId?: string }>();
  const selectedColor = watch('color') || MICROAREA_COLORS[0];

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
    onError: reportError,
  });

  if (isLoading) return <CircularProgress />;

  return (
    <>
      <TabToolbar
        title="Microáreas"
        onAdd={() => {
          setEditing(null);
          reset({ number: data.length + 1, name: `Microárea ${String(data.length + 1).padStart(2, '0')}`, color: MICROAREA_COLORS[data.length % MICROAREA_COLORS.length] });
          setOpen(true);
        }}
        addLabel="Nova Microárea"
        canManage={canManage}
      />
      <TableContainer>
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
                {canManage && (
                  <IconButton size="small" onClick={() => {
                    setEditing(row);
                    reset({ number: row.number, name: row.name, color: row.color, description: row.description, ubsId: row.ubsId, acsId: row.acsId });
                    setOpen(true);
                  }}>
                    <Edit fontSize="small" />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar Microárea' : 'Nova Microárea'}</DialogTitle>
        <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Número" type="number" {...register('number', { valueAsNumber: true, required: true })} fullWidth />
            <TextField label="Nome" {...register('name', { required: true })} fullWidth />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Cor da microárea</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {MICROAREA_COLORS.map((c) => (
                  <Box
                    key={c}
                    onClick={() => setValue('color', c)}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      bgcolor: c,
                      cursor: 'pointer',
                      border: selectedColor === c ? '3px solid' : '2px solid transparent',
                      borderColor: selectedColor === c ? 'text.primary' : 'transparent',
                      boxShadow: selectedColor === c ? 2 : 0,
                    }}
                  />
                ))}
                <Box
                  component="input"
                  type="color"
                  value={selectedColor}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('color', e.target.value)}
                  sx={{
                    width: 36,
                    height: 36,
                    border: 'none',
                    borderRadius: 2,
                    cursor: 'pointer',
                    p: 0,
                  }}
                />
              </Box>
              <input type="hidden" {...register('color', { required: true })} />
            </Box>
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

function MunicipalityTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError } = useCadastros();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const { register, handleSubmit, reset } = useForm<{
    name: string;
    state: string;
    prefecture: string;
    secretariat: string;
  }>();

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
    mutationFn: (values: { name: string; state: string; prefecture: string; secretariat: string }) =>
      municipalitiesApi.update(municipalityId, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['municipality'] }),
    onError: reportError,
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => municipalitiesApi.uploadLogo(municipalityId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['municipality'] }),
    onError: reportError,
  });

  if (isLoading || !municipality) return <CircularProgress />;

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>Dados do município</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          {municipality.logoUrl ? (
            <Box
              component="img"
              src={assetUrl(municipality.logoUrl) ?? ''}
              alt="Logo"
              sx={{ maxWidth: '100%', maxHeight: '100%' }}
            />
          ) : (
            <Typography variant="caption" color="text.secondary">Sem logo</Typography>
          )}
        </Box>
        <Box>
          {canManage && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => fileRef.current?.click()}
              disabled={logoMutation.isPending}
            >
              {logoMutation.isPending ? 'Enviando...' : 'Enviar logotipo'}
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            PNG, JPG, WEBP ou SVG
          </Typography>
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

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Nome" {...register('name', { required: true })} fullWidth disabled={!canManage} />
          <TextField label="UF" {...register('state', { required: true, maxLength: 2 })} fullWidth disabled={!canManage} />
          <TextField label="Prefeitura" {...register('prefecture', { required: true })} fullWidth disabled={!canManage} />
          <TextField label="Secretaria" {...register('secretariat', { required: true })} fullWidth disabled={!canManage} />
          {canManage && (
            <Button type="submit" variant="contained" disabled={saveMutation.isPending}>
              Salvar dados
            </Button>
          )}
        </Box>
      </form>
    </Box>
  );
}

const TAB_ITEMS = [
  { label: 'Município', icon: <AccountBalance fontSize="small" /> },
  { label: 'UBS', icon: <LocalHospital fontSize="small" /> },
  { label: 'ACS', icon: <People fontSize="small" /> },
  { label: 'Bairros', icon: <LocationCity fontSize="small" /> },
  { label: 'Microáreas', icon: <GridView fontSize="small" /> },
];

function TabToolbar({
  title,
  onAdd,
  addLabel,
  canManage = true,
}: {
  title: string;
  onAdd: () => void;
  addLabel: string;
  canManage?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
      {canManage && (
        <Button startIcon={<Add />} variant="contained" size="small" onClick={onAdd}>
          {addLabel}
        </Button>
      )}
    </Box>
  );
}

export function CadastrosPage() {
  const theme = useTheme();
  const municipalityId = useMunicipalityId();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageCadastros(user?.role);
  const [tab, setTab] = useState(0);

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <CadastrosProvider>
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <PageHeader
        title="Cadastros"
        subtitle="Gerencie município, UBS, ACS, bairros e microáreas"
      />

      {!canManage && (
        <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
          Você está em modo visualização. Para cadastrar ou editar, peça acesso ao coordenador da APS.
        </Alert>
      )}

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              minHeight: 52,
              gap: 0.75,
            },
          }}
        >
          {TAB_ITEMS.map((item) => (
            <Tab
              key={item.label}
              label={item.label}
              icon={item.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>
        <CardContent sx={{ pt: 3 }}>
          <Box
            key={tab}
            className="page-enter"
            sx={{
              '& .MuiTableHead-root .MuiTableCell-root': {
                fontWeight: 700,
                bgcolor: alpha(theme.palette.primary.main, 0.06),
              },
              '& .MuiTableRow-root:hover': {
                bgcolor: alpha(theme.palette.action.hover, 0.4),
              },
            }}
          >
            {tab === 0 && <MunicipalityTab municipalityId={municipalityId} />}
            {tab === 1 && <UbsTab municipalityId={municipalityId} />}
            {tab === 2 && <AcsTab municipalityId={municipalityId} />}
            {tab === 3 && <NeighborhoodsTab municipalityId={municipalityId} />}
            {tab === 4 && <MicroareasTab municipalityId={municipalityId} />}
          </Box>
        </CardContent>
      </Card>
    </Box>
    </CadastrosProvider>
  );
}
