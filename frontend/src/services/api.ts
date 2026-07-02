import axios from 'axios';

const API_URL =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.PROD ? '' : 'http://localhost:3000');

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: import.meta.env.PROD ? 90_000 : 30_000,
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
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
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
  latitude: number;
  longitude: number;
  _count?: { microareas: number };
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

export interface SearchResult {
  streets: Array<{ id: string; name: string; streetType?: string; geojson?: GeoJSON.LineString; microarea?: { id: string; name: string; color: string } }>;
  neighborhoods: Array<{ id: string; name: string; _count: { streets: number } }>;
  ubs: Array<{ id: string; name: string; address: string; latitude: number; longitude: number }>;
  acs: Array<{ id: string; name: string; phone?: string; microarea?: { id: string; name: string; color: string } }>;
  microareas: Array<{ id: string; name: string; number: number; color: string }>;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
};

export const municipalitiesApi = {
  list: () => api.get('/municipalities'),
  get: (id: string) => api.get(`/municipalities/${id}`),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/municipalities/${id}`, data),
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
};

export const microareasApi = {
  list: (municipalityId: string) =>
    api.get<Microarea[]>(`/microareas/municipality/${municipalityId}`),
  create: (data: Partial<Microarea> & { municipalityId: string; number: number; name: string; color: string }) =>
    api.post('/microareas', data),
  update: (id: string, data: Partial<Microarea>) =>
    api.patch(`/microareas/${id}`, data),
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
    cpf: string;
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

export const searchApi = {
  query: (municipalityId: string, q: string) =>
    api.get<SearchResult>(`/search/municipality/${municipalityId}`, { params: { q } }),
};

export const dashboardApi = {
  indicators: (municipalityId: string) =>
    api.get(`/dashboard/${municipalityId}`),
};

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
  createdAt: string;
  user: { id: string; name: string; role: string; email: string };
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
  audit: (municipalityId: string, page = 1, limit = 50) =>
    api.get<{
      items: AuditLogEntry[];
      total: number;
      page: number;
      limit: number;
      pages: number;
    }>(`/admin/municipality/${municipalityId}/audit`, { params: { page, limit } }),
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
  exportStreets: (municipalityId: string, microareaId?: string) =>
    api.get(`/geo/export/${municipalityId}`, {
      params: microareaId ? { microareaId } : undefined,
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
