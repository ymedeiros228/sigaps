type LngLat = [number, number];

export function fixCoordPair(pair: number[]): LngLat {
  const [a, b] = pair;
  if (Math.abs(a) <= 20 && Math.abs(b) >= 28) return [b, a];
  return [a, b];
}

export function fixLineStringCoordinates(coords: number[][]): LngLat[] {
  return coords.map((c) => fixCoordPair(c));
}

export function isValidBrazilCoord(lng: number, lat: number): boolean {
  return lat >= -35 && lat <= 10 && lng >= -75 && lng <= -28;
}
