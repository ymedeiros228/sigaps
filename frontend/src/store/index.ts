import { create } from 'zustand';
import type { Microarea, User } from '../services/api';

interface MapState {
  paintMode: boolean;
  selectedMicroareaId: string | null;
  selectedStreetIds: Set<string>;
  showEnvelopes: boolean;
  baseLayer: 'map' | 'satellite' | 'terrain' | 'hybrid';
  highlightedStreetId: string | null;
  setPaintMode: (enabled: boolean) => void;
  setSelectedMicroarea: (id: string | null) => void;
  toggleStreetSelection: (id: string) => void;
  clearSelection: () => void;
  setShowEnvelopes: (show: boolean) => void;
  setBaseLayer: (layer: MapState['baseLayer']) => void;
  setHighlightedStreet: (id: string | null) => void;
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
  user: null,
  token: null,
  setAuth: (user, token, refreshToken) => {
    localStorage.setItem('sigaps_token', token);
    localStorage.setItem('sigaps_refresh', refreshToken);
    localStorage.setItem('sigaps_user', JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.clear();
    set({ user: null, token: null });
  },
  hydrate: () => {
    const token = localStorage.getItem('sigaps_token');
    const userStr = localStorage.getItem('sigaps_user');
    if (token && userStr) {
      set({ token, user: JSON.parse(userStr) });
    }
  },
}));

export const useMapStore = create<MapState>((set, get) => ({
  paintMode: false,
  selectedMicroareaId: null,
  selectedStreetIds: new Set(),
  showEnvelopes: true,
  baseLayer: 'map',
  highlightedStreetId: null,
  setPaintMode: (enabled) => set({ paintMode: enabled }),
  setSelectedMicroarea: (id) => set({ selectedMicroareaId: id }),
  toggleStreetSelection: (id) => {
    const next = new Set(get().selectedStreetIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ selectedStreetIds: next });
  },
  clearSelection: () => set({ selectedStreetIds: new Set() }),
  setShowEnvelopes: (show) => set({ showEnvelopes: show }),
  setBaseLayer: (layer) => set({ baseLayer: layer }),
  setHighlightedStreet: (id) => set({ highlightedStreetId: id }),
}));

export const useAppStore = create<AppState>((set) => ({
  municipalityId: null,
  microareas: [],
  darkMode: true,
  setMunicipalityId: (id) => set({ municipalityId: id }),
  setMicroareas: (microareas) => set({ microareas }),
  toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
}));
