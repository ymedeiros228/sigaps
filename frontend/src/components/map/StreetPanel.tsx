import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Button,
  Chip,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SignpostIcon from '@mui/icons-material/Signpost';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import AutoFixOffIcon from '@mui/icons-material/AutoFixOff';
import SaveIcon from '@mui/icons-material/Save';
import LinearScaleIcon from '@mui/icons-material/LinearScale';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { useQuery } from '@tanstack/react-query';
import { streetsApi, type Microarea, type Neighborhood, type Street } from '../../services/api';
import FormatPaintIcon from '@mui/icons-material/FormatPaint';
import {
  getStreetSideAssignment,
  isDualSideStreet,
  segmentLengthPercent,
  sideLabel,
  uniqueMicroareasOnStreet,
} from '../../utils/streetPaintSegments';

type AssignmentMode = 'FULL' | 'SPLIT';

interface StreetPanelProps {
  street: Street;
  microareas: Microarea[];
  neighborhoods: Neighborhood[];
  onClose: () => void;
  onAssign: (microareaId: string) => void;
  onAssignSides: (data: {
    mode: AssignmentMode;
    microareaId?: string;
    leftMicroareaId?: string;
    rightMicroareaId?: string;
    leftSideNotes?: string;
    rightSideNotes?: string;
  }) => void;
  onAssignNeighborhood: (neighborhoodId: string | null) => void;
  onUnassign: () => void;
  onEditPaint?: () => void;
  onUpdateDemographics: (data: {
    familyCount: number;
    inhabitantCount: number;
    propertyCount: number;
  }) => void;
  assigning: boolean;
  assigningSides: boolean;
  assigningNeighborhood: boolean;
  unassigning: boolean;
  savingDemographics: boolean;
}

function SidePanel({
  title,
  microareaId,
  notes,
  microareas,
  onMicroareaChange,
  onNotesChange,
  disabled,
}: {
  title: string;
  microareaId: string;
  notes: string;
  microareas: Microarea[];
  onMicroareaChange: (id: string) => void;
  onNotesChange: (notes: string) => void;
  disabled: boolean;
}) {
  const selected = microareas.find((m) => m.id === microareaId);
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: '2px solid',
        borderColor: selected?.color ?? 'divider',
        bgcolor: selected ? alpha(selected.color, 0.06) : 'transparent',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
        {title}
      </Typography>
      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>Microárea</InputLabel>
        <Select
          label="Microárea"
          value={microareaId}
          disabled={disabled}
          onChange={(e) => onMicroareaChange(String(e.target.value))}
        >
          <MenuItem value="">
            <em>Nenhuma</em>
          </MenuItem>
          {microareas.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} />
                {m.name}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {selected && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          <Chip
            size="small"
            label={selected.name}
            sx={{ bgcolor: selected.color, color: '#fff', fontWeight: 600 }}
          />
          {selected.acs?.name && (
            <Chip size="small" variant="outlined" label={`ACS: ${selected.acs.name}`} />
          )}
        </Box>
      )}
      <TextField
        fullWidth
        size="small"
        label="Observações"
        multiline
        minRows={2}
        value={notes}
        disabled={disabled}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder="Ex.: limite com a Microárea 02"
      />
    </Box>
  );
}

export function StreetPanel({
  street,
  microareas,
  neighborhoods,
  onClose,
  onAssign,
  onAssignSides,
  onAssignNeighborhood,
  onUnassign,
  onEditPaint,
  onUpdateDemographics,
  assigning,
  assigningSides,
  assigningNeighborhood,
  unassigning,
  savingDemographics,
}: StreetPanelProps) {
  const theme = useTheme();
  const dualSide = isDualSideStreet(street);
  const sideAssignment = useMemo(() => getStreetSideAssignment(street), [street]);

  const accent =
    street.paintSegments?.[0]?.microarea?.color ??
    street.microarea?.color ??
    theme.palette.primary.main;
  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.92)
    : alpha('#fff', 0.95);

  const [familyCount, setFamilyCount] = useState(String(street.familyCount ?? 0));
  const [inhabitantCount, setInhabitantCount] = useState(String(street.inhabitantCount ?? 0));
  const [propertyCount, setPropertyCount] = useState(String(street.propertyCount ?? 0));

  const [assignMode, setAssignMode] = useState<AssignmentMode>(
    sideAssignment.mode === 'SPLIT' ? 'SPLIT' : 'FULL',
  );
  const [fullMicroareaId, setFullMicroareaId] = useState(
    sideAssignment.fullMicroareaId ?? street.microareaId ?? '',
  );
  const [leftMicroareaId, setLeftMicroareaId] = useState(sideAssignment.leftMicroareaId ?? '');
  const [rightMicroareaId, setRightMicroareaId] = useState(sideAssignment.rightMicroareaId ?? '');
  const [leftNotes, setLeftNotes] = useState(street.leftSideNotes ?? '');
  const [rightNotes, setRightNotes] = useState(street.rightSideNotes ?? '');

  useEffect(() => {
    setFamilyCount(String(street.familyCount ?? 0));
    setInhabitantCount(String(street.inhabitantCount ?? 0));
    setPropertyCount(String(street.propertyCount ?? 0));
    const sa = getStreetSideAssignment(street);
    setAssignMode(sa.mode === 'SPLIT' ? 'SPLIT' : 'FULL');
    setFullMicroareaId(sa.fullMicroareaId ?? street.microareaId ?? '');
    setLeftMicroareaId(sa.leftMicroareaId ?? '');
    setRightMicroareaId(sa.rightMicroareaId ?? '');
    setLeftNotes(street.leftSideNotes ?? '');
    setRightNotes(street.rightSideNotes ?? '');
  }, [street.id, street.familyCount, street.inhabitantCount, street.propertyCount, street.microareaId, street.paintSegments, street.leftSideNotes, street.rightSideNotes]);

  const demographicsDirty =
    parseInt(familyCount, 10) !== (street.familyCount ?? 0) ||
    parseInt(inhabitantCount, 10) !== (street.inhabitantCount ?? 0) ||
    parseInt(propertyCount, 10) !== (street.propertyCount ?? 0);

  const hasSegments = (street.paintSegments?.length ?? 0) > 0;
  const microareasOnStreet = useMemo(() => uniqueMicroareasOnStreet(street), [street]);
  const hasMultipleMicroareas = microareasOnStreet.length > 1;

  const sidesDirty =
    dualSide &&
    (assignMode !== (sideAssignment.mode === 'SPLIT' ? 'SPLIT' : 'FULL') ||
      (assignMode === 'FULL' && fullMicroareaId !== (sideAssignment.fullMicroareaId ?? '')) ||
      (assignMode === 'SPLIT' &&
        (leftMicroareaId !== (sideAssignment.leftMicroareaId ?? '') ||
          rightMicroareaId !== (sideAssignment.rightMicroareaId ?? '') ||
          leftNotes !== (street.leftSideNotes ?? '') ||
          rightNotes !== (street.rightSideNotes ?? ''))));

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggest-microarea', street.id],
    queryFn: () => streetsApi.suggest(street.id).then((r) => r.data as Array<{ id: string; name: string; color: string }>),
    enabled: !street.microareaId && !hasSegments,
    staleTime: 60_000,
  });

  const topSuggestion = suggestions[0];

  const handleSaveSides = () => {
    if (assignMode === 'FULL') {
      if (!fullMicroareaId) return;
      onAssignSides({ mode: 'FULL', microareaId: fullMicroareaId });
      return;
    }
    onAssignSides({
      mode: 'SPLIT',
      leftMicroareaId: leftMicroareaId || undefined,
      rightMicroareaId: rightMicroareaId || undefined,
      leftSideNotes: leftNotes || undefined,
      rightSideNotes: rightNotes || undefined,
    });
  };

  return (
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        top: { xs: 100, sm: 120 },
        right: { xs: 8, sm: 16 },
        left: { xs: 8, sm: 'auto' },
        zIndex: 1000,
        width: { xs: 'auto', sm: 360 },
        maxHeight: { xs: 'calc(100vh - 200px)', sm: 'calc(100vh - 140px)' },
        overflow: 'auto',
        bgcolor: glassBg,
        borderRadius: 3,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(accent, 0.15),
                color: accent,
                flexShrink: 0,
              }}
            >
              <SignpostIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                {street.streetType ?? 'Rua'}
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                {street.name}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Alert severity="info" icon={<LightbulbOutlinedIcon fontSize="small" />} sx={{ mt: 1.5, py: 0.5, borderRadius: 2 }}>
          <Typography variant="caption" component="div">
            {hasMultipleMicroareas
              ? 'Esta rua tem partes com cores diferentes. Toque em "Colorir no mapa" para ajustar.'
              : dualSide
                ? 'Avenidas podem ter cores diferentes em cada lado.'
                : 'Toque em "Colorir no mapa" e depois toque nas ruas.'}
          </Typography>
        </Alert>

        {hasSegments && (
          <Box sx={{ mt: 1.5, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <LinearScaleIcon fontSize="small" />
              Trechos pintados ({street.paintSegments!.length})
            </Typography>
            {microareasOnStreet.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                {microareasOnStreet.map((ma) => (
                  <Chip
                    key={ma.microareaId}
                    size="small"
                    label={`${ma.name}${ma.segmentCount > 1 ? ` · ${ma.segmentCount} trechos` : ''}`}
                    sx={{ bgcolor: ma.color, color: '#fff', fontWeight: 600 }}
                  />
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, maxHeight: 160, overflowY: 'auto' }}>
              {street.paintSegments!.map((seg) => (
                <Box
                  key={seg.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: alpha(seg.microarea?.color ?? '#888', 0.4),
                    bgcolor: alpha(seg.microarea?.color ?? '#888', 0.08),
                  }}
                >
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      bgcolor: seg.microarea?.color ?? '#888',
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {seg.microarea?.name ?? 'Microárea'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {seg.side && seg.side !== 'FULL' ? `${sideLabel(seg.side)} · ` : ''}
                      ~{segmentLengthPercent(street, seg)}% da rua
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            {onEditPaint && (
              <Button
                fullWidth
                variant="contained"
                size="small"
                startIcon={<FormatPaintIcon />}
                onClick={onEditPaint}
                sx={{ mt: 1.25, fontWeight: 700 }}
              >
                Editar no mapa
              </Button>
            )}
          </Box>
        )}

        {!hasSegments && onEditPaint && (
          <Button
            fullWidth
            variant="outlined"
            size="small"
            startIcon={<FormatPaintIcon />}
            onClick={onEditPaint}
            sx={{ mt: 1.5, mb: 1, fontWeight: 700 }}
          >
            Pintar no mapa
          </Button>
        )}

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 2 }}>
          <StatBox label="Imóveis" value={street.propertyCount} />
          <StatBox label="Famílias" value={street.familyCount} />
          <StatBox label="Habitantes" value={street.inhabitantCount} />
          <StatBox
            label="Comprimento"
            value={street.lengthMeters ? `${Math.round(street.lengthMeters)} m` : '—'}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Famílias e habitantes
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1 }}>
            <TextField
              size="small"
              label="Famílias"
              type="number"
              slotProps={{ htmlInput: { min: 0 } }}
              value={familyCount}
              onChange={(e) => setFamilyCount(e.target.value)}
            />
            <TextField
              size="small"
              label="Habitantes"
              type="number"
              slotProps={{ htmlInput: { min: 0 } }}
              value={inhabitantCount}
              onChange={(e) => setInhabitantCount(e.target.value)}
            />
            <TextField
              size="small"
              label="Imóveis"
              type="number"
              slotProps={{ htmlInput: { min: 0 } }}
              value={propertyCount}
              onChange={(e) => setPropertyCount(e.target.value)}
            />
          </Box>
          {demographicsDirty && (
            <Button
              fullWidth
              size="small"
              variant="contained"
              sx={{ mt: 1 }}
              startIcon={savingDemographics ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
              disabled={savingDemographics}
              onClick={() =>
                onUpdateDemographics({
                  familyCount: Math.max(0, parseInt(familyCount, 10) || 0),
                  inhabitantCount: Math.max(0, parseInt(inhabitantCount, 10) || 0),
                  propertyCount: Math.max(0, parseInt(propertyCount, 10) || 0),
                })
              }
            >
              {savingDemographics ? 'Salvando…' : 'Salvar dados'}
            </Button>
          )}
        </Box>

        <InfoRow label="Bairro" value={street.neighborhood?.name ?? '—'} />

        <Divider sx={{ my: 2 }} />

        {dualSide ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <CallSplitIcon fontSize="small" />
              Modo de atribuição
            </Typography>
            <RadioGroup
              value={assignMode}
              onChange={(e) => setAssignMode(e.target.value as AssignmentMode)}
            >
              <FormControlLabel value="FULL" control={<Radio size="small" />} label="Rua inteira" />
              <FormControlLabel value="SPLIT" control={<Radio size="small" />} label="Dividir por lados" />
            </RadioGroup>

            {assignMode === 'FULL' ? (
              <Box sx={{ mt: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Microárea</InputLabel>
                  <Select
                    label="Microárea"
                    value={fullMicroareaId}
                    disabled={assigningSides}
                    onChange={(e) => setFullMicroareaId(String(e.target.value))}
                  >
                    {microareas.map((m) => (
                      <MenuItem key={m.id} value={m.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: m.color }} />
                          {m.name}
                          {m.acs?.name ? ` · ${m.acs.name}` : ''}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {fullMicroareaId && (
                  <Box sx={{ mt: 1 }}>
                    {(() => {
                      const m = microareas.find((x) => x.id === fullMicroareaId);
                      if (!m) return null;
                      return (
                        <Chip
                          size="small"
                          label={`${m.name}${m.acs?.name ? ` · ACS ${m.acs.name}` : ''}`}
                          sx={{ bgcolor: m.color, color: '#fff', fontWeight: 600 }}
                        />
                      );
                    })()}
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
                <SidePanel
                  title="Lado direito"
                  microareaId={rightMicroareaId}
                  notes={rightNotes}
                  microareas={microareas}
                  disabled={assigningSides}
                  onMicroareaChange={setRightMicroareaId}
                  onNotesChange={setRightNotes}
                />
                <SidePanel
                  title="Lado esquerdo"
                  microareaId={leftMicroareaId}
                  notes={leftNotes}
                  microareas={microareas}
                  disabled={assigningSides}
                  onMicroareaChange={setLeftMicroareaId}
                  onNotesChange={setLeftNotes}
                />
              </Box>
            )}

            {(sidesDirty || (assignMode === 'FULL' && fullMicroareaId && !street.microareaId)) && (
              <Button
                fullWidth
                variant="contained"
                size="small"
                sx={{ mt: 1.5, fontWeight: 700 }}
                disabled={assigningSides || (assignMode === 'FULL' ? !fullMicroareaId : !leftMicroareaId && !rightMicroareaId)}
                startIcon={assigningSides ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                onClick={handleSaveSides}
              >
                {assigningSides ? 'Salvando…' : 'Salvar atribuição'}
              </Button>
            )}
          </Box>
        ) : (
          <>
            <InfoRow
              label="Microárea"
              value={
                hasMultipleMicroareas ? (
                  <Typography variant="body2" color="text.secondary">
                    {microareasOnStreet.length} microáreas nesta rua
                  </Typography>
                ) : street.microarea ? (
                  <Chip
                    size="small"
                    label={street.microarea.name}
                    sx={{ bgcolor: street.microarea.color, color: '#fff', fontWeight: 600 }}
                  />
                ) : microareasOnStreet[0] ? (
                  <Chip
                    size="small"
                    label={microareasOnStreet[0].name}
                    sx={{ bgcolor: microareasOnStreet[0].color, color: '#fff', fontWeight: 600 }}
                  />
                ) : (
                  <Typography variant="body2" color="text.secondary">Não vinculada</Typography>
                )
              }
            />

            {!street.microareaId && !hasSegments && topSuggestion && (
              <Box sx={{ mb: 2, mt: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Sugestão automática
                </Typography>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  disabled={assigning}
                  onClick={() => onAssign(topSuggestion.id)}
                  sx={{ borderColor: topSuggestion.color, justifyContent: 'flex-start', gap: 1 }}
                >
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: topSuggestion.color }} />
                  Vincular à {topSuggestion.name}
                </Button>
              </Box>
            )}

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, mt: 1 }}>
              Vincular à microárea
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {microareas.map((m) => {
                const selected = street.microareaId === m.id;
                return (
                  <Button
                    key={m.id}
                    variant={selected ? 'contained' : 'outlined'}
                    size="small"
                    disabled={assigning}
                    onClick={() => onAssign(m.id)}
                    sx={{
                      justifyContent: 'flex-start',
                      gap: 1,
                      borderColor: m.color,
                      ...(selected && { bgcolor: m.color, '&:hover': { bgcolor: m.color, filter: 'brightness(0.92)' } }),
                    }}
                  >
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: selected ? '#fff' : m.color }} />
                    {assigning ? <CircularProgress size={14} sx={{ mr: 0.5 }} /> : null}
                    {m.name}
                  </Button>
                );
              })}
            </Box>
          </>
        )}

        {(street.microareaId || hasSegments) && (
          <Button
            fullWidth
            variant="outlined"
            color="warning"
            size="medium"
            disabled={unassigning}
            startIcon={<AutoFixOffIcon />}
            onClick={onUnassign}
            sx={{ mt: 2, fontWeight: 700, borderWidth: 2 }}
          >
            {unassigning ? 'Removendo…' : 'Remover toda a pintura desta rua'}
          </Button>
        )}

        <Divider sx={{ my: 2 }} />

        {neighborhoods.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Bairro
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Atribuir bairro</InputLabel>
              <Select
                label="Atribuir bairro"
                value={street.neighborhood?.id ?? ''}
                disabled={assigningNeighborhood}
                onChange={(e) => {
                  const v = e.target.value;
                  onAssignNeighborhood(v === '' ? null : String(v));
                }}
              >
                <MenuItem value="">
                  <em>Sem bairro</em>
                </MenuItem>
                {neighborhoods.map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Box sx={{ textAlign: 'right' }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{value}</Typography>
        ) : (
          value
        )}
      </Box>
    </Box>
  );
}
