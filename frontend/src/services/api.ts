import axios from 'axios';

/** URL da API: vazio em produção = mesma origem (Render unificado). */
function resolveApiUrl(): string {
  const env = import.meta.env.VITE_API_URL;
  if (typeof env === 'string' && env.length > 0) return env;
  if (import.meta.env.PROD) return '';
  return 'http://localhost:3000';
}

const API_URL = resolveApiUrl();

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: import.meta.env.PROD ? 45_000 : 30_000,
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(token: string) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

let cachedAccessToken: string | null = null;

function readTokenFromStorage(): string | null {
  try {
    return localStorage.getItem('sigaps_token');
  } catch {
    return null;
  }
}

export function syncApiToken(token: string | null) {
  cachedAccessToken = token;
}

cachedAccessToken = readTokenFromStorage();

api.interceptors.request.use((config) => {
  const token = cachedAccessToken ?? readTokenFromStorage();
  if (token) {
    cachedAccessToken = token;
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('sigaps_refresh');
    if (!refreshToken) {
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshQueue.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
      localStorage.setItem('sigaps_token', data.accessToken);
      localStorage.setItem('sigaps_refresh', data.refreshToken);
      syncApiToken(data.accessToken);
      processQueue(data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(originalRequest);
    } catch {
      localStorage.clear();
      window.location.href = '/login';
      return Promise.reject(error);
    } finally {
      isRefreshing = false;
    }
  },
);

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  municipalityId?: string;
  acsProfile?: {
    id: string;
    microarea?: { id: string; name: string; number: number; color: string };
  };
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface Municipality {
  id: string;
  name: string;
  state: string;
  prefecture: string;
  secretariat: string;
  logoUrl?: string | null;
  latitude: number;
  longitude: number;
  mapHomologatedAt?: string | null;
  mapHomologatedBy?: string | null;
  mapHomologationNotes?: string | null;
  esusLastSyncAt?: string | null;
}

export interface CadastrosSummary {
  ubs: number;
  acs: number;
  neighborhoods: number;
  microareas: number;
  acsSemMicro: number;
  acsAtivos: number;
}

export interface Street {
  id: string;
  name: string;
  streetType?: string;
  osmId?: string | null;
  geojson: GeoJSON.LineString;
  microareaId?: string;
  microarea?: {
    id: string;
    name: string;
    number: number;
    color: string;
  };
  lengthMeters?: number;
  propertyCount: number;
  familyCount: number;
  inhabitantCount: number;
  notes?: string;
  updatedAt: string;
  neighborhood?: { id: string; name: string };
}

export interface Microarea {
  id: string;
  number: number;
  name: string;
  color: string;
  description?: string;
  status?: string;
  ubsId?: string;
  acsId?: string;
  neighborhoodId?: string;
  ubs?: { id: string; name: string };
  acs?: { id: string; name: string; phone?: string };
  neighborhood?: { id: string; name: string };
  _count?: { streets: number };
}

export interface Ubs {
  id: string;
  name: string;
  address: string;
  phone?: string;
  coordinator?: string;
  cnesCode?: string;
  latitude: number;
  longitude: number;
  _count?: { microareas: number };
}

export interface CnesLookupResult {
  cnesCode: string;
  name: string;
  address: string;
  municipality: string;
  uf: string;
  phone?: string;
  active: boolean;
  source: 'api' | 'format-only';
}

export interface Acs {
  id: string;
  name: string;
  cpf: string;
  phone?: string;
  photoUrl?: string;
  status: string;
  microarea?: { id: string; name: string; number: number; color: string };
}

export interface Neighborhood {
  id: string;
  name: string;
  _count?: { streets: number };
}

export type PlaceKind = 'POVOADO' | 'LOCALIDADE' | 'DISTRITO';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  latitude: number;
  longitude: number;
  osmNodeId?: string | null;
  notes?: string | null;
  municipalityId: string;
}

export interface NominatimResult {
  placeId: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  kind: string;
}

export interface CadastrosBundle {
  municipality: Municipality;
  summary: CadastrosSummary;
  microareas: Microarea[];
  ubs: Ubs[];
  acs: Acs[];
  neighborhoods: Neighborhood[];
}

export interface SearchResult {
  streets: Array<{ id: string; name: string; streetType?: string; geojson?: GeoJSON.LineString; microarea?: { id: string; name: string; color: string } }>;
  neighborhoods: Array<{ id: string; name: string; _count: { streets: number } }>;
  ubs: Array<{ id: string; name: string; address: string; latitude: number; longitude: number }>;
  acs: Array<{ id: string; name: string; phone?: string; microarea?: { id: string; name: string; color: string } }>;
  microareas: Array<{ id: string; name: string; number: number; color: string }>;
  places: Array<{ id: string; name: string; kind: PlaceKind; latitude: number; longitude: number }>;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
};

export const cadastrosApi = {
  getBundle: (municipalityId: string) =>
    api.get<CadastrosBundle>(`/cadastros/municipality/${municipalityId}`),
};

export const municipalitiesApi = {
  list: () => api.get<Municipality[]>('/municipalities'),
  get: (id: string) => api.get<Municipality>(`/municipalities/${id}`),
  cadastrosSummary: (id: string) =>
    api.get<CadastrosSummary>(`/municipalities/${id}/cadastros-summary`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/municipalities/${id}`, data),
  setMapHomologation: (id: string, data: { homologated: boolean; notes?: string }) =>
    api.patch<Municipality>(`/municipalities/${id}/map-homologation`, data),
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/municipalities/${id}/logo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const streetsApi = {
  list: (municipalityId: string, params?: Record<string, string | number | boolean>) =>
    api.get<{ items: Street[]; total: number }>(
      `/streets/municipality/${municipalityId}`,
      { params },
    ),
  get: (id: string) => api.get<Street>(`/streets/${id}`),
  assign: (streetIds: string[], microareaId: string, forceTransfer = false) =>
    api.post('/streets/assign', { streetIds, microareaId, forceTransfer }),
  unassign: (streetIds: string[]) =>
    api.post<{ cleared: number }>('/streets/unassign', { streetIds }),
  clearAssignments: (municipalityId: string) =>
    api.post<{ cleared: number }>(
      `/streets/municipality/${municipalityId}/clear-assignments`,
    ),
  suggest: (id: string) => api.get(`/streets/${id}/suggest-microarea`),
  assignNeighborhood: (streetIds: string[], neighborhoodId: string | null) =>
    api.post<{ updated: number; neighborhoodId: string | null }>('/streets/assign-neighborhood', {
      streetIds,
      neighborhoodId,
    }),
  bulkNeighborhood: (
    municipalityId: string,
    items: Array<{ streetRef: string; neighborhoodRef: string }>,
  ) =>
    api.post<{
      updated: number;
      errors: Array<{ row: number; streetRef: string; message: string }>;
      total: number;
    }>('/streets/bulk-neighborhood', { municipalityId, items }),
  updateDemographics: (
    id: string,
    data: { familyCount?: number; inhabitantCount?: number; propertyCount?: number; notes?: string },
  ) => api.patch<Street>(`/streets/${id}/demographics`, data),
  bulkDemographics: (
    municipalityId: string,
    items: Array<{
      streetRef: string;
      familyCount: number;
      inhabitantCount: number;
      propertyCount?: number;
    }>,
  ) =>
    api.post<{
      updated: number;
      errors: Array<{ row: number; streetRef: string; message: string }>;
      total: number;
    }>('/streets/bulk-demographics', { municipalityId, items }),
};

export const microareasApi = {
  list: (municipalityId: string) =>
    api.get<Microarea[]>(`/microareas/municipality/${municipalityId}`),
  listEnvelopes: (municipalityId: string) =>
    api.get<
      Array<{
        id: string;
        name: string;
        color: string;
        number: number;
        geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
        labelLat: number | null;
        labelLng: number | null;
      }>
    >(`/microareas/municipality/${municipalityId}/envelopes`),
  create: (data: Partial<Microarea> & { municipalityId: string; number: number; name: string; color: string }) =>
    api.post('/microareas', data),
  update: (id: string, data: Partial<Microarea>) =>
    api.patch(`/microareas/${id}`, data),
  remove: (id: string) => api.delete(`/microareas/${id}`),
  envelope: (id: string) => api.get(`/microareas/${id}/envelope`),
};

export const ubsApi = {
  list: (municipalityId: string) =>
    api.get<Ubs[]>(`/ubs/municipality/${municipalityId}`),
  create: (data: Omit<Ubs, 'id' | '_count'> & { municipalityId: string }) =>
    api.post('/ubs', data),
  update: (id: string, data: Partial<Ubs>) => api.patch(`/ubs/${id}`, data),
  remove: (id: string) => api.delete(`/ubs/${id}`),
};

export const acsApi = {
  list: (municipalityId: string) =>
    api.get<Acs[]>(`/acs/municipality/${municipalityId}`),
  create: (data: {
    name: string;
    cpf?: string;
    municipalityId: string;
    phone?: string;
    status?: string;
    microareaId?: string;
  }) => api.post('/acs', data),
  update: (
    id: string,
    data: Partial<Acs> & { microareaId?: string | null },
  ) => api.patch(`/acs/${id}`, data),
  bulkImport: (
    municipalityId: string,
    items: Array<{
      name: string;
      cpf: string;
      phone?: string;
      microareaRef?: string;
      status?: string;
    }>,
  ) =>
    api.post<{ created: number; updated: number; errors: Array<{ row: number; cpf: string; message: string }>; total: number }>(
      '/acs/bulk',
      { municipalityId, items },
    ),
  remove: (id: string) => api.delete(`/acs/${id}`),
  uploadPhoto: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<Acs>(`/acs/${id}/photo`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const neighborhoodsApi = {
  list: (municipalityId: string) =>
    api.get<Neighborhood[]>(`/neighborhoods/municipality/${municipalityId}`),
  create: (data: { name: string; municipalityId: string }) =>
    api.post('/neighborhoods', data),
  update: (id: string, data: { name?: string }) =>
    api.patch(`/neighborhoods/${id}`, data),
  remove: (id: string) => api.delete(`/neighborhoods/${id}`),
};

export const placesApi = {
  list: (municipalityId: string) =>
    api.get<Place[]>(`/places/municipality/${municipalityId}`),
  create: (data: {
    name: string;
    kind?: PlaceKind;
    latitude: number;
    longitude: number;
    municipalityId: string;
    notes?: string;
  }) => api.post<Place>('/places', data),
  update: (
    id: string,
    data: Partial<{
      name: string;
      kind: PlaceKind;
      latitude: number;
      longitude: number;
      notes: string;
    }>,
  ) => api.patch<Place>(`/places/${id}`, data),
  remove: (id: string) => api.delete(`/places/${id}`),
  importFromOsm: (municipalityId: string) =>
    api.post<{ imported: number; updated: number; skipped: number }>(
      `/places/import-osm/${municipalityId}`,
    ),
  searchNominatim: (municipalityId: string, q: string) =>
    api.get<NominatimResult[]>('/places/nominatim', { params: { municipalityId, q } }),
};

export const searchApi = {
  query: (municipalityId: string, q: string) =>
    api.get<SearchResult>(`/search/municipality/${municipalityId}`, { params: { q } }),
};

export const dashboardApi = {
  indicators: (municipalityId: string) =>
    api.get(`/dashboard/${municipalityId}`),
  checklist: (municipalityId: string) =>
    api.get<OperationalChecklist>(`/dashboard/municipality/${municipalityId}/checklist`),
  checklistCsv: (municipalityId: string) =>
    api.get(`/dashboard/municipality/${municipalityId}/checklist.csv`, {
      responseType: 'blob',
    }),
  acsCoverage: (municipalityId: string) =>
    api.get<AcsCoverageRow[]>(`/dashboard/municipality/${municipalityId}/acs-coverage`),
  acsCoverageCsv: (municipalityId: string) =>
    api.get(`/dashboard/municipality/${municipalityId}/acs-coverage.csv`, {
      responseType: 'blob',
    }),
};

export interface OperationalChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
  priority: 'critical' | 'high' | 'medium';
  actionHref?: string;
}

export interface OperationalChecklist {
  items: OperationalChecklistItem[];
  completed: number;
  total: number;
  progressPct: number;
  readyForHomologation: boolean;
}

export interface AcsCoverageRow {
  acsId: string;
  acsName: string;
  microareaId: string | null;
  microareaName: string | null;
  microareaNumber: number | null;
  ubsName: string | null;
  streetCount: number;
  microareaStreetTotal: number;
  streetCoveragePct: number;
  municipalitySharePct: number;
  familyCount: number;
  inhabitantCount: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOverview {
  municipality: {
    id: string;
    name: string;
    state: string;
    prefecture: string;
    secretariat: string;
    logoUrl?: string;
    updatedAt: string;
  };
  counts: {
    users: number;
    activeUsers: number;
    ubs: number;
    acs: number;
    acsSemMicro: number;
    microareas: number;
    streets: number;
    assignedStreets: number;
    paintZones: number;
    auditLogs: number;
    coverage: number;
  };
  users: AdminUser[];
  system: {
    commit: string | null;
    nodeEnv: string;
    exportedAt: string;
  };
}

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; role: string; email: string };
}

export interface AuditFilters {
  entityType?: string;
  action?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export const adminApi = {
  overview: (municipalityId: string) =>
    api.get<AdminOverview>(`/admin/municipality/${municipalityId}/overview`),
  exportBackup: (municipalityId: string) =>
    api.get<Record<string, unknown>>(`/admin/municipality/${municipalityId}/backup/export`),
  importBackup: (municipalityId: string, payload: Record<string, unknown>) =>
    api.post<{ ok: boolean; restored: Record<string, number> }>(
      `/admin/municipality/${municipalityId}/backup/import`,
      payload,
      { timeout: 300_000 },
    ),
  listAutoBackups: (municipalityId: string) =>
    api.get<{
      lastAutoBackupAt: string | null;
      items: Array<{ filename: string; sizeBytes: number; createdAt: string }>;
      retentionNote: string;
    }>(`/admin/municipality/${municipalityId}/backup/auto`),
  runAutoBackup: (municipalityId: string) =>
    api.post<{ filename: string; sizeBytes: number; createdAt: string }>(
      `/admin/municipality/${municipalityId}/backup/auto/run`,
    ),
  downloadAutoBackup: (municipalityId: string, filename: string) =>
    api.get<Record<string, unknown>>(
      `/admin/municipality/${municipalityId}/backup/auto/${encodeURIComponent(filename)}`,
    ),
  audit: (municipalityId: string, page = 1, limit = 50, filters?: AuditFilters) =>
    api.get<{
      items: AuditLogEntry[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>(`/admin/municipality/${municipalityId}/audit`, {
      params: { page, limit, ...filters },
    }),
  exportAuditCsv: (municipalityId: string, filters?: AuditFilters) =>
    api.get(`/admin/municipality/${municipalityId}/audit/export.csv`, {
      params: filters,
      responseType: 'blob',
    }),
  createUser: (
    municipalityId: string,
    data: { email: string; password: string; name: string; role: string },
  ) => api.post<AdminUser>(`/admin/municipality/${municipalityId}/users`, data),
  updateUser: (
    municipalityId: string,
    userId: string,
    data: Partial<{ email: string; name: string; role: string; isActive: boolean }>,
  ) => api.patch<AdminUser>(`/admin/municipality/${municipalityId}/users/${userId}`, data),
  resetPassword: (municipalityId: string, userId: string, password: string) =>
    api.post(`/admin/municipality/${municipalityId}/users/${userId}/reset-password`, {
      password,
    }),
};

export const integrationsApi = {
  lookupCnes: (code: string) =>
    api.get<CnesLookupResult>(`/integrations/cnes/${encodeURIComponent(code)}`),
  importEsus: (municipalityId: string, csv: string) =>
    api.post<{ updated: number; total: number; errors: Array<{ row: number; streetRef: string; message: string }>; lastSyncAt?: string }>(
      `/integrations/esus/import/${municipalityId}`,
      { csv },
    ),
  syncEsus: (municipalityId: string) =>
    api.post<{
      ok: boolean;
      message: string;
      lastSyncAt: string | null;
      updated: number;
      total: number;
      errors: Array<{ row: number; streetRef: string; message: string }>;
    }>(`/integrations/esus/municipality/${municipalityId}/sync`),
};

export const osmApi = {
  import: (municipalityId: string) =>
    api.post(`/osm/import/${municipalityId}`, undefined, { timeout: 300_000 }),
};

export const geoApi = {
  import: (municipalityId: string, data: { geojson: object; updateByName?: boolean }) =>
    api.post<{ imported: number; updated: number; skipped: number; total: number }>(
      `/geo/import/${municipalityId}`,
      data,
    ),
  importKml: (municipalityId: string, file: File, updateByName = false) => {
    const form = new FormData();
    form.append('file', file);
    form.append('updateByName', String(updateByName));
    return api.post<{ imported: number; updated: number; skipped: number; total: number }>(
      `/geo/import/${municipalityId}/kml`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
  importCsv: (municipalityId: string, file: File, updateByName = false) => {
    const form = new FormData();
    form.append('file', file);
    form.append('updateByName', String(updateByName));
    return api.post<{ imported: number; updated: number; skipped: number; total: number }>(
      `/geo/import/${municipalityId}/csv`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
  },
  importShapefile: (municipalityId: string, file: File, updateByName = false) => {
    const form = new FormData();
    form.append('file', file);
    form.append('updateByName', String(updateByName));
    return api.post<{ imported: number; updated: number; skipped: number; total: number }>(
      `/geo/import/${municipalityId}/shapefile`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000 },
    );
  },
  exportStreets: (municipalityId: string, microareaId?: string) =>
    api.get(`/geo/export/${municipalityId}`, {
      params: microareaId ? { microareaId } : undefined,
    }),
  exportStreetsKml: (municipalityId: string, microareaId?: string) =>
    api.get<string>(`/geo/export/${municipalityId}/kml`, {
      params: microareaId ? { microareaId } : undefined,
      responseType: 'text' as const,
    }),
  exportMicroareas: (municipalityId: string) =>
    api.get(`/geo/export/${municipalityId}/microareas`),
};

export interface PaintZone {
  id: string;
  name: string | null;
  microareaId: string;
  municipalityId: string;
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  geojson: GeoJSON.Polygon;
  createdAt: string;
  microarea: { id: string; name: string; color: string; number: number };
}

export const paintZonesApi = {
  list: (municipalityId: string) =>
    api.get<PaintZone[]>(`/paint-zones/municipality/${municipalityId}`),
  createCircle: (
    municipalityId: string,
    data: {
      microareaId: string;
      centerLat: number;
      centerLng: number;
      radiusMeters: number;
      name?: string;
    },
  ) => api.post<PaintZone>(`/paint-zones/municipality/${municipalityId}/circle`, data),
  remove: (id: string) => api.delete<{ removed: boolean }>(`/paint-zones/${id}`),
};
