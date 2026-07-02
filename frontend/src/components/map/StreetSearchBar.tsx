import { useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { Clear, Search } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '../../services/api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatStreetLabel, streetMatchesQuery, fixLineString } from '../../utils/streetSearch';

export type StreetSearchOption = {
  id: string;
  label: string;
  group: string;
  kind: 'street' | 'neighborhood' | 'ubs' | 'acs' | 'microarea' | 'place';
  lat?: number;
  lng?: number;
  microareaId?: string;
  geojson?: GeoJSON.LineString;
};

interface StreetSearchBarProps {
  municipalityId: string | null;
  streets: Array<{ id: string; name: string; streetType?: string; geojson: GeoJSON.LineString }>;
  onSelect: (option: StreetSearchOption) => void;
}

export function StreetSearchBar({ municipalityId, streets, onSelect }: StreetSearchBarProps) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(text, 300);

  const { data: searchData, isFetching, isError: searchError, refetch: refetchSearch } = useQuery({
    queryKey: ['unified-search', municipalityId, debounced],
    queryFn: () => searchApi.query(municipalityId!, debounced).then((r) => r.data),
    enabled: !!municipalityId && debounced.trim().length >= 2,
    staleTime: 30_000,
    retry: 2,
  });

  const options = useMemo<StreetSearchOption[]>(() => {
    const q = debounced.trim();
    if (q.length < 2) return [];

    const map = new Map<string, StreetSearchOption>();

    if (streets.length <= 500) {
      streets
        .filter((s) => streetMatchesQuery(s, q))
        .slice(0, 20)
        .forEach((s) => {
          map.set(s.id, {
            id: s.id,
            label: formatStreetLabel(s),
            group: 'Ruas no mapa',
            kind: 'street',
            geojson: s.geojson,
          });
        });
    }

    searchData?.streets.forEach((s) => {
      if (!map.has(s.id) && s.geojson) {
        map.set(s.id, {
          id: s.id,
          label: formatStreetLabel(s),
          group: 'Todas as ruas',
          kind: 'street',
          geojson: fixLineString(s.geojson as GeoJSON.LineString),
        });
      }
    });

    searchData?.neighborhoods.forEach((n) =>
      map.set(`n-${n.id}`, { id: n.id, label: n.name, group: 'Bairros', kind: 'neighborhood' }),
    );
    searchData?.microareas.forEach((m) =>
      map.set(`m-${m.id}`, {
        id: m.id,
        label: m.name,
        group: 'Microáreas',
        kind: 'microarea',
      }),
    );
    searchData?.acs.forEach((a) =>
      map.set(`a-${a.id}`, {
        id: a.id,
        label: a.name,
        group: a.microarea ? `ACS — ${a.microarea.name}` : 'ACS',
        kind: 'acs',
        microareaId: a.microarea?.id,
      }),
    );
    searchData?.ubs.forEach((u) =>
      map.set(`u-${u.id}`, {
        id: u.id,
        label: u.name,
        group: 'UBS',
        kind: 'ubs',
        lat: u.latitude,
        lng: u.longitude,
      }),
    );
    searchData?.places.forEach((p) =>
      map.set(`p-${p.id}`, {
        id: p.id,
        label: p.name,
        group: 'Povoados',
        kind: 'place',
        lat: p.latitude,
        lng: p.longitude,
      }),
    );

    return Array.from(map.values()).slice(0, 25);
  }, [debounced, streets, searchData]);

  const pick = (opt: StreetSearchOption) => {
    onSelect(opt);
    setText('');
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && options.length > 0) {
      e.preventDefault();
      pick(options[0]);
    }
    if (e.key === 'Escape') setOpen(false);
  };

  const showList = open && text.trim().length >= 2;

  return (
    <Box sx={{ position: 'relative', minWidth: { xs: '100%', sm: 300 }, flex: { sm: 1 } }}>
      <TextField
        size="small"
        fullWidth
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder="Buscar rua, bairro, UBS, ACS..."
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {isFetching ? <CircularProgress size={16} /> : <Search fontSize="small" color="action" />}
              </InputAdornment>
            ),
            endAdornment: text ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setText('')} aria-label="Limpar busca">
                  <Clear fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          },
        }}
      />

      {showList && (
        <Paper
          elevation={8}
          sx={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 2000,
            mt: 0.5,
            maxHeight: 280,
            overflow: 'auto',
            borderRadius: 2,
          }}
        >
          {searchError ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Busca indisponível no momento.
              </Typography>
              <Typography
                variant="body2"
                color="primary"
                sx={{ cursor: 'pointer', fontWeight: 600 }}
                onMouseDown={() => void refetchSearch()}
              >
                Tentar novamente
              </Typography>
            </Box>
          ) : options.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
              Nenhuma rua encontrada. Tente só o nome (ex: &quot;Siqueira&quot;).
            </Typography>
          ) : (
            <List dense disablePadding>
              {options.map((opt) => (
                <ListItemButton key={`${opt.kind}-${opt.id}`} onMouseDown={() => pick(opt)}>
                  <ListItemText
                    primary={opt.label}
                    secondary={opt.group}
                    slotProps={{
                      primary: { sx: { fontWeight: 600, fontSize: 14 } },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
      )}
    </Box>
  );
}
