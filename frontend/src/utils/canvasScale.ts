/** Escala do canvas: 1x, 2x ou 3x (sempre inteira: com 2,625x o apagar parcial deixaria resto de linha). */
export function canvasScaleFor(devicePixelRatio: number, deviceMemoryGb?: number): number {
  if (devicePixelRatio <= 1) return 1;
  if (devicePixelRatio <= 2) return 2;
  // Celular fraco (≤ 2 GB): fica no 2x para não pesar ao pintar.
  return deviceMemoryGb !== undefined && deviceMemoryGb <= 2 ? 2 : 3;
}
