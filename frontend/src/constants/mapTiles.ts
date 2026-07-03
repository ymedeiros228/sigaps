export type MapBaseLayerId = 'map' | 'satellite' | 'terrain' | 'hybrid';

export type MapTileConfig = {
  name: string;
  url: string;
  attribution: string;
  maxZoom?: number;
  /** Esri não tem imagem nativa acima de ~17 em Passagem Franca — evita placeholder cinza. */
  maxNativeZoom?: number;
  subdomains?: string | string[];
  detectRetina?: boolean;
};

export const MAP_TILE_LAYERS: Record<MapBaseLayerId, MapTileConfig> = {
  map: {
    name: 'Mapa',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
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
    subdomains: ['a', 'b', 'c'],
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

export const MAP_LABELS_OVERLAY = {
  url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
  attribution: '&copy; CARTO',
  maxZoom: 20,
  subdomains: ['a', 'b', 'c', 'd'],
};
