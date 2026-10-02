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

/** OpenStreetMap — ruas e nomes bem legíveis para pintar microáreas. */
export const MAP_TILE_LAYERS: Record<MapBaseLayerId, MapTileConfig> = {
  map: {
    name: 'Mapa',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    detectRetina: false,
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

/**
 * Reserva se o OSM não carregar (rede lenta ou bloqueio temporário): Esri World Street Map.
 * Obs.: os tiles do CARTO passaram a exigir chave de API (mostram marca d'água), por isso não são usados.
 */
export const MAP_TILE_OSM_FALLBACK: MapTileConfig = {
  name: 'Mapa (reserva)',
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri',
  maxZoom: 19,
  maxNativeZoom: 19,
  detectRetina: false,
};

/** Rótulos (nomes de ruas e lugares) sobre o satélite no modo Híbrido — Esri, sem chave de API. */
export const MAP_LABELS_OVERLAY = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  attribution: '&copy; Esri',
  maxZoom: 19,
  maxNativeZoom: 17,
  subdomains: undefined as string | string[] | undefined,
};
