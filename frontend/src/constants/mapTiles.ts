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

/** CARTO Voyager (dados OSM) — fundo calmo e nomes nítidos: as cores das microáreas se destacam. */
export const MAP_TILE_LAYERS: Record<MapBaseLayerId, MapTileConfig> = {
  map: {
    name: 'Mapa',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 20,
    maxNativeZoom: 20,
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
    attribution: '&copy; Esri + OSM',
    maxZoom: 19,
    maxNativeZoom: 17,
    detectRetina: false,
  },
};

/** Reserva se o CARTO não carregar (rede lenta ou bloqueio temporário): OpenStreetMap padrão. */
export const MAP_TILE_OSM_FALLBACK: MapTileConfig = {
  name: 'Mapa (reserva)',
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap',
  maxZoom: 19,
  subdomains: ['a', 'b', 'c'],
  detectRetina: false,
};

export const MAP_LABELS_OVERLAY = {
  url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  attribution: '&copy; CARTO',
  maxZoom: 20,
  subdomains: 'abcd',
};
