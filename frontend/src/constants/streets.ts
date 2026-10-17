// Limites de quantidade de ruas do mapa.
// Ficam aqui (e não no hook do mapa) para que quem só precisa do número, como o
// pré-carregamento em utils/prefetchAppData.ts, não puxe o react-leaflet/Leaflet
// para a tela de login.

/** Acima disso o FE considera “mapa grande” (UI/probe). */
export const VIEWPORT_STREETS_THRESHOLD = 800;
/** Só ativa carregamento por bbox acima deste total — evita quebrar municípios ~800–1200 ruas. */
export const VIEWPORT_LOAD_ACTIVATE_ABOVE = 1200;
