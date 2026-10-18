import { describe, expect, it } from 'vitest';
import { inStreetQueue } from './streetRequestQueue';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('fila de pedidos por rua', () => {
  it('mesma rua: o segundo pedido só sai quando o primeiro volta', async () => {
    const log: string[] = [];
    const request = (name: string, ms: number) => async () => {
      log.push(`envia ${name}`);
      await wait(ms);
      log.push(`volta ${name}`);
      return name;
    };
    const results = await Promise.all([
      inStreetQueue('rua-1', request('A', 20)),
      inStreetQueue('rua-1', request('B', 1)),
    ]);
    expect(results).toEqual(['A', 'B']);
    expect(log).toEqual(['envia A', 'volta A', 'envia B', 'volta B']);
  });

  it('ruas diferentes seguem em paralelo', async () => {
    const log: string[] = [];
    await Promise.all([
      inStreetQueue('rua-1', async () => {
        await wait(20);
        log.push('rua-1');
      }),
      inStreetQueue('rua-2', async () => {
        log.push('rua-2');
      }),
    ]);
    expect(log).toEqual(['rua-2', 'rua-1']);
  });

  it('um pedido com erro não trava os seguintes', async () => {
    const failed = inStreetQueue('rua-3', async () => {
      throw new Error('sem rede');
    });
    const next = inStreetQueue('rua-3', async () => 'ok');
    await expect(failed).rejects.toThrow('sem rede');
    await expect(next).resolves.toBe('ok');
  });
});
