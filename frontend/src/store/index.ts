import { create } from 'zustand';
import type { Microarea, PaintScope, PaintStreetSide, User } from '../services/api';
import { syncApiToken } from '../services/api';
import { DEV_LOGIN } from '../constants/devAuth';
import { lineStringBounds, lineStringCentroid, boundsFromLineStrings } from '../utils/geo';

export const ACTIVE_MUNICIPALITY_KEY = 'sigaps_active_municipality';

function safeStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage indisponível */
  }
}

function safeStorageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage indisponível */
  }
}

function readPersistedMunicipalityId(): string | null {
  return safeStorageGet(ACTIVE_MUNICIPALITY_KEY);
}

function resolveInitialMunicipalityId(user: User | null): string | null {
  if (user?.role === 'ADMINISTRADOR') {
    const persisted = readPersistedMunicipalityId();
    if (persisted) return persisted;
  }
  return user?.municipalityId ?? null;
}

function readPersistedAuth(): { user: User | null; token: string | null } {
  try {
    const token = safeStorageGet('sigaps_token');
    const userStr = safeStorageGet('sigaps_user');
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) as User };
    }
  } catch {
    clearPersistedSession();
  }
  return { user: null, token: null };
}

function clearPersistedSession() {
  safeStorageRemove('sigaps_token');
  safeStorageRemove('sigaps_refresh');
  safeStorageRemove('sigaps_user');
}

const persistedAuth = readPersistedAuth();

interface MapState {
  paintMode: boolean;
  eraserMode: boolean;
  selectedMicroareaId: string | null;
  selectedStreetIds: Set<string>;
  showEnvelopes: boolean;
  showHeatmap: boolean;
  showUbsMarkers: boolean;
  showPlacesMarkers: boolean;
  baseLayer: 'map' | 'satellite' | 'terrain' | 'hybrid';
  highlightedStreetId: string | null;
  mapFlyTarget: {
    seq: number;
    lat: number;
    lng: number;
    zoom: number;
    bounds?: [[number, number], [number, number]];
  } | null;
  paintGuideCollapsed: boolean;
  dragPaintIds: Set<string>;
  mapPanEnabled: boolean;
  divisionMode: boolean;
  divisionDraft: { lat: number; lng: number; radiusMeters: number; name: string } | null;
  paintStreetSide: PaintStreetSide;
  paintScope: PaintScope;
  setPaintMode: (enabled: boolean) => void;
  setEraserMode: (enabled: boolean) => void;
  setSelectedMicroarea: (id: string | null) => void;
  setPaintStreetSide: (side: PaintStreetSide) => void;
  setPaintScope: (scope: PaintScope) => void;
  toggleStreetSelection: (id: string) => void;
  clearSelection: () => void;
  setShowEnvelopes: (show: boolean) => void;
  setShowHeatmap: (show: boolean) => void;
  setShowUbsMarkers: (show: boolean) => void;
  setShowPlacesMarkers: (show: boolean) => void;
  setBaseLayer: (layer: MapState['baseLayer']) => void;
  setHighlightedStreet: (id: string | null) => void;
  setPaintGuideCollapsed: (collapsed: boolean) => void;
  addDragPaintId: (id: string) => void;
  clearDragPaintIds: () => Set<string>;
  setMapPanEnabled: (enabled: boolean) => void;
  setDivisionMode: (enabled: boolean) => void;
  setDivisionDraft: (draft: MapState['divisionDraft']) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  focusOnLine: (geojson: GeoJSON.LineString, zoom?: number) => void;
  focusOnLines: (geojsons: GeoJSON.LineString[], zoom?: number) => void;
  clearMapFly: () => void;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  hydrate: () => void;
}

interface AppState {
  municipalityId: string | null;
  microareas: Microarea[];
  darkMode: boolean;
  setMunicipalityId: (id: string) => void;
  setMicroareas: (microareas: Microarea[]) => void;
  toggleDarkMode: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: persistedAuth.user,
  token: persistedAuth.token,
  setAuth: (user, token, refreshToken) => {
    safeStorageSet('sigaps_token', token);
    safeStorageSet('sigaps_refresh', refreshToken);
    safeStorageSet('sigaps_user', JSON.stringify(user));
    syncApiToken(token);
    if (import.meta.env.DEV) {
      safeStorageSet('sigaps_dev_email', user.email);
      safeStorageSet('sigaps_dev_password', DEV_LOGIN.password);
    }
    const municipalityId = resolveInitialMunicipalityId(user);
    if (municipalityId) {
      useAppStore.getState().setMunicipalityId(municipalityId);
    } else if (user.municipalityId) {
      useAppStore.getState().setMunicipalityId(user.municipalityId);
    }
    set({ user, token });
  },
  logout: () => {
    const activeMunicipality = readPersistedMunicipalityId();
    clearPersistedSession();
    if (activeMunicipality) {
      safeStorageSet(ACTIVE_MUNICIPALITY_KEY, activeMunicipality);
    }
    syncApiToken(null);
    set({ user: null, token: null });
  },
  hydrate: () => {
    try {
      const token = safeStorageGet('sigaps_token');
      const userStr = safeStorageGet('sigaps_user');
      if (token && userStr) {
        syncApiToken(token);
        const user = JSON.parse(userStr) as User;
        const municipalityId = resolveInitialMunicipalityId(user);
        if (municipalityId) {
          useAppStore.getState().setMunicipalityId(municipalityId);
        }
        set({ token, user });
      }
    } catch {
      clearPersistedSession();
      syncApiToken(null);
      set({ token: null, user: null });
    }
  },
}));

export const useMapStore = create<MapState>((set, get) => ({
  paintMode: false,
  eraserMode: false,
  selectedMicroareaId: null,
  selectedStreetIds: new Set(),
  showEnvelopes: false,
  showHeatmap: false,
  showUbsMarkers: true,
  showPlacesMarkers: true,
  baseLayer: 'map',
  highlightedStreetId: null,
  mapFlyTarget: null,
  paintGuideCollapsed: true,
  dragPaintIds: new Set(),
  mapPanEnabled: true,
  divisionMode: false,
  divisionDraft: null,
  paintStreetSide: 'FULL' as PaintStreetSide,
  paintScope: 'brush' as PaintScope,
  setPaintMode: (enabled) => {
    const state = get();
    if (enabled && !state.selectedMicroareaId) {
      const microareas = useAppStore.getState().microareas;
      if (microareas.length > 0) {
        set({
          paintMode: enabled,
          selectedMicroareaId: microareas[0].id,
          mapPanEnabled: false,
        });
        return;
      }
    }
    set({
      paintMode: enabled,
      eraserMode: enabled ? get().eraserMode : false,
      mapPanEnabled: enabled ? false : true,
      ...(enabled ? {} : { dragPaintIds: new Set<string>() }),
    });
  },
  setEraserMode: (enabled) => {
    set({
      eraserMode: enabled,
      paintMode: enabled ? true : get().paintMode,
      mapPanEnabled: enabled ? false : get().mapPanEnabled,
      dragPaintIds: new Set<string>(),
      ...(enabled ? { paintScope: 'brush' as const } : {}),
    });
  },
  setSelectedMicroarea: (id) => set({ selectedMicroareaId: id }),
  setPaintStreetSide: (side) => set({ paintStreetSide: side }),
  setPaintScope: (scope) => set({ paintScope: scope }),
  toggleStreetSelection: (id) => {
    const next = new Set(get().selectedStreetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedStreetIds: next });
  },
  clearSelection: () => set({ selectedStreetIds: new Set() }),
  setShowEnvelopes: (show) => set({ showEnvelopes: show }),
  setShowHeatmap: (show) => set({ showHeatmap: show }),
  setShowUbsMarkers: (show) => set({ showUbsMarkers: show }),
  setShowPlacesMarkers: (show) => set({ showPlacesMarkers: show }),
  setBaseLayer: (layer) => set({ baseLayer: layer }),
  setHighlightedStreet: (id) => set({ highlightedStreetId: id }),
  setPaintGuideCollapsed: (collapsed) => set({ paintGuideCollapsed: collapsed }),
  addDragPaintId: (id) => {
    const next = new Set(get().dragPaintIds);
    next.add(id);
    set({ dragPaintIds: next });
  },
  clearDragPaintIds: () => {
    const ids = get().dragPaintIds;
    set({ dragPaintIds: new Set() });
    return ids;
  },
  setMapPanEnabled: (enabled) => set({ mapPanEnabled: enabled }),
  setDivisionMode: (enabled) =>
    set({
      divisionMode: enabled,
      paintMode: enabled ? false : get().paintMode,
      divisionDraft: enabled ? get().divisionDraft : null,
    }),
  setDivisionDraft: (draft) => set({ divisionDraft: draft }),
  flyTo: (lat, lng, zoom = 16) =>
    set((s) => ({
      mapFlyTarget: {
        seq: (s.mapFlyTarget?.seq ?? 0) + 1,
        lat,
        lng,
        zoom,
      },
    })),
  focusOnLine: (geojson, zoom = 18) => {
    const bounds = lineStringBounds(geojson);
    const center = lineStringCentroid(geojson);
    if (!center && !bounds) return;
    set((s) => ({
      mapFlyTarget: {
        seq: (s.mapFlyTarget?.seq ?? 0) + 1,
        lat: center?.lat ?? bounds![0][0],
        lng: center?.lng ?? bounds![0][1],
        zoom,
        bounds: bounds ?? undefined,
      },
    }));
  },
  focusOnLines: (geojsons, zoom = 17) => {
    const bounds = boundsFromLineStrings(geojsons);
    if (!bounds) return;
    const centerLat = (bounds[0][0] + bounds[1][0]) / 2;
    const centerLng = (bounds[0][1] + bounds[1][1]) / 2;
    set((s) => ({
      mapFlyTarget: {
        seq: (s.mapFlyTarget?.seq ?? 0) + 1,
        lat: centerLat,
        lng: centerLng,
        zoom,
        bounds,
      },
    }));
  },
  clearMapFly: () => set({ mapFlyTarget: null }),
}));

export const useAppStore = create<AppState>((set) => ({
  municipalityId: resolveInitialMunicipalityId(persistedAuth.user),
  microareas: [],
  darkMode: true,
  setMunicipalityId: (id) => {
    safeStorageSet(ACTIVE_MUNICIPALITY_KEY, id);
    set({ municipalityId: id });
  },
  setMicroareas: (microareas) => set({ microareas }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}));
