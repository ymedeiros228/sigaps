import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sigaps_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sigaps_token');
      localStorage.removeItem('sigaps_refresh');
      window.location.href = '/login';
    }
    return Promise.reject(error);
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
  acs?: { id: string; name: string; phone?: string };
  _count?: { streets: number };
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { email, password }),
};

export const municipalitiesApi = {
  list: () => api.get('/municipalities'),
  get: (id: string) => api.get(`/municipalities/${id}`),
};

export const streetsApi = {
  list: (municipalityId: string, params?: Record<string, string | number>) =>
    api.get<{ items: Street[]; total: number }>(
      `/streets/municipality/${municipalityId}`,
      { params },
    ),
  get: (id: string) => api.get<Street>(`/streets/${id}`),
  assign: (streetIds: string[], microareaId: string, forceTransfer = false) =>
    api.post('/streets/assign', { streetIds, microareaId, forceTransfer }),
  suggest: (id: string) => api.get(`/streets/${id}/suggest-microarea`),
};

export const microareasApi = {
  list: (municipalityId: string) =>
    api.get<Microarea[]>(`/microareas/municipality/${municipalityId}`),
  envelope: (id: string) => api.get(`/microareas/${id}/envelope`),
};

export const dashboardApi = {
  indicators: (municipalityId: string) =>
    api.get(`/dashboard/${municipalityId}`),
};

export const osmApi = {
  import: (municipalityId: string) =>
    api.post(`/osm/import/${municipalityId}`),
};
