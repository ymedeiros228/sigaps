/**
 * Converte um valor desconhecido em string apenas quando é um primitivo,
 * evitando a saída "[object Object]" e satisfazendo a regra
 * @typescript-eslint/no-base-to-string ao lidar com dados dinâmicos
 * (propriedades de GeoJSON, respostas de APIs externas, etc.).
 */
export function toText(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return fallback;
}
