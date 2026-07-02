import { create } from 'zustand';
import type { Microarea, User } from '../services/api';
import { syncApiToken } from '../services/api';
import { DEV_LOGIN } from '../constants/devAuth';
import { lineStringBounds, lineStringCentroid, boundsFromLineStrings } from '../utils/geo';

function readPersistedAuth(): { user: User | null; token: string | null } {
  try {
    const token = localStorage.getItem('sigaps_token');
    const userStr = localStorage.getItem('sigaps_user');
    if (token && userStr) {
      return { token, user: JSON.parse(userStr) as User };
    }
  } catch {
    /* sessão inválida */
  }
  return { user: null, token: null };
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
  setPaintMode: (enabled: boolean) => void;
  setEraserMode: (enabled: boolean) => void;
  setSelectedMicroarea: (id: string | null) => void;
  toggleStreetSelection: (id: string) => void;
  clearSelection: () => void;
  setShowEnvelopes: (show: boolean) => void;
  setShowHeatmap: (show: boolean) => void;
  setShowUbsMarkers: (show: boolean) => void;
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
    localStorage.setItem('sigaps_token', token);
    localStorage.setItem('sigaps_refresh', refreshToken);
    localStorage.setItem('sigaps_user', JSON.stringify(user));
    syncApiToken(token);
    if (import.meta.env.DEV) {
      localStorage.setItem('sigaps_dev_email', user.email);
      localStorage.setItem('sigaps_dev_password', DEV_LOGIN.password);
    }
    if (user.municipalityId) {
      useAppStore.getState().setMunicipalityId(user.municipalityId);
    }
    set({ user, token });
  },
  logout: () => {
    localStorage.clear();
    syncApiToken(null);
    set({ user: null, token: null });
  },
  hydrate: () => {
    const token = localStorage.getItem('sigaps_token');
    const userStr = localStorage.getItem('sigaps_user');
    if (token && userStr) {
      syncApiToken(token);
      const user = JSON.parse(userStr) as User;
      if (user.municipalityId) {
        useAppStore.getState().setMunicipalityId(user.municipalityId);
      }
      set({ token, user });
    }
  },
}));

export const useMapStore = create<MapState>((set, get) => ({
  paintMode: false,
  eraserMode: false,
  selectedMicroareaId: null,
  selectedStreetIds: new Set(),
  showEnvelopes: true,
  showHeatmap: false,
  showUbsMarkers: true,
  baseLayer: 'satellite',
  highlightedStreetId: null,
  mapFlyTarget: null,
  paintGuideCollapsed: false,
  dragPaintIds: new Set(),
  mapPanEnabled: true,
  divisionMode: false,
  divisionDraft: null,
  setPaintMode: (enabled) => {
    const state = get();
    if (enabled && !state.selectedMicroareaId) {
      const microareas = useAppStore.getState().microareas;
      if (microareas.length > 0) {
        set({
          paintMode: enabled,
          selectedMicroareaId: microareas[0].id,
          paintGuideCollapsed: false,
          mapPanEnabled: false,
        });
        return;
      }
    }
    set({
      paintMode: enabled,
      eraserMode: enabled ? get().eraserMode : false,
      paintGuideCollapsed: enabled ? false : state.paintGuideCollapsed,
      mapPanEnabled: enabled ? false : true,
    });
  },
  setEraserMode: (enabled) => {
    set({
      eraserMode: enabled,
      paintMode: enabled ? true : get().paintMode,
      mapPanEnabled: enabled ? false : get().mapPanEnabled,
    });
  },
  setSelectedMicroarea: (id) => set({ selectedMicroareaId: id }),
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
  municipalityId: persistedAuth.user?.municipalityId ?? null,
  microareas: [],
  darkMode: true,
  setMunicipalityId: (id) => set({ municipalityId: id }),
  setMicroareas: (microareas) => set({ microareas }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}));
