export type MapBaseLayerId = 'map' | 'satellite' | 'terrain' | 'hybrid';

export type MapTileConfig = {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  /** Evita pedir tiles inexistentes (placeholder cinza no Esri). */
  maxNativeZoom?: number;
  subdomains?: string | string[];
  detectRetina?: boolean;
};

/** Carto Voyager — CDN estável para mapa de ruas. */
export const MAP_TILE_LAYERS: Record<MapBaseLayerId, MapTileConfig> = {
  map: {
    name: 'Mapa',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 20,
    subdomains: 'abcd',
    detectRetina: true,
  },
  satellite: {
    name: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    maxZoom: 19,
    maxNativeZoom: 17,
    detectRetina: false,
  },
  terrain: {
    name: 'Relevo',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17,
    subdomains: 'abc',
    detectRetina: false,
  },
  hybrid: {
    name: 'Híbrido',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri + CARTO',
    maxZoom: 19,
    maxNativeZoom: 17,
    detectRetina: false,
  },
};

/** Se satélite falhar, tenta mapa de ruas. */
export const MAP_TILE_FALLBACK_CHAIN: MapBaseLayerId[] = ['map'];

export const MAP_LABELS_OVERLAY = {
  url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  attribution: '&copy; CARTO',
  maxZoom: 20,
  subdomains: 'abcd',
};
