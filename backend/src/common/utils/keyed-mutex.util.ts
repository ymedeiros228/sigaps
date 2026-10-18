/**
 * Fila por chave dentro do processo: tarefas com a mesma chave rodam uma de cada vez,
 * na ordem de chegada; chaves diferentes seguem em paralelo.
 *
 * Usado na pintura das ruas: dois toques rápidos na mesma rua liam o mesmo estado e
 * regravavam os trechos um por cima do outro (pintura perdida e linhas duplicadas).
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<unknown>>();

  get size(): number {
    return this.tails.size;
  }

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    // Espera a anterior terminar, com sucesso ou erro, e só então começa.
    const result = previous.then(task, task);
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return result;
  }
}
