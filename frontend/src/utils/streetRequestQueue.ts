/**
 * Fila por rua: pedidos de pintar/despintar da mesma rua saem um depois do outro.
 * Em paralelo, dois toques rápidos liam o mesmo estado no servidor e um apagava o outro.
 * Ruas diferentes continuam em paralelo.
 */
const tails = new Map<string, Promise<unknown>>();

export function inStreetQueue<T>(streetId: string, request: () => Promise<T>): Promise<T> {
  const previous = tails.get(streetId) ?? Promise.resolve();
  // Espera o anterior terminar, com sucesso ou erro, e só então envia.
  const result = previous.then(request, request);
  const tail = result.catch(() => undefined);
  tails.set(streetId, tail);
  void tail.then(() => {
    if (tails.get(streetId) === tail) tails.delete(streetId);
  });
  return result;
}
