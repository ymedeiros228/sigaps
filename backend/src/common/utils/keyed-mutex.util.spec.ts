import { KeyedMutex } from './keyed-mutex.util';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('KeyedMutex', () => {
  it('mesma chave roda uma de cada vez, na ordem de chegada', async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const job = (name: string, ms: number) => async () => {
      log.push(`início ${name}`);
      await wait(ms);
      log.push(`fim ${name}`);
      return name;
    };

    const results = await Promise.all([
      mutex.run('rua-1', job('A', 20)),
      mutex.run('rua-1', job('B', 1)),
    ]);

    expect(results).toEqual(['A', 'B']);
    expect(log).toEqual(['início A', 'fim A', 'início B', 'fim B']);
  });

  it('chaves diferentes não esperam uma pela outra', async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    await Promise.all([
      mutex.run('rua-1', async () => {
        await wait(20);
        log.push('rua-1');
      }),
      mutex.run('rua-2', async () => {
        log.push('rua-2');
      }),
    ]);
    expect(log).toEqual(['rua-2', 'rua-1']);
  });

  it('um erro não trava a fila da chave', async () => {
    const mutex = new KeyedMutex();
    const failed = mutex.run('rua-1', async () => {
      throw new Error('falhou');
    });
    const next = mutex.run('rua-1', async () => 'seguiu');

    await expect(failed).rejects.toThrow('falhou');
    await expect(next).resolves.toBe('seguiu');
  });

  it('libera a chave quando a fila esvazia', async () => {
    const mutex = new KeyedMutex();
    await mutex.run('rua-1', async () => 1);
    await wait(0);
    expect(mutex.size).toBe(0);
  });
});
