import type L from 'leaflet';

/** Mapa principal aberto na tela, para a foto do PDF poder ajustar tamanho e zoom direto nele. */
let currentMap: L.Map | null = null;

export function getCurrentLeafletMap(): L.Map | null {
  return currentMap;
}

export function setCurrentLeafletMap(map: L.Map | null) {
  currentMap = map;
}
