import { existsSync, readFileSync } from 'fs';
import type { PrismaClient } from '@prisma/client';
import { importStreetsFromBundledGeoJson } from './bundled-streets.import';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

describe('importStreetsFromBundledGeoJson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports unnamed residential streets with generated names', async () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              osmId: '456',
              highway: 'residential',
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-43.78, -6.18],
                [-43.781, -6.181],
              ],
            },
          },
        ],
      }),
    );

    const upsert = jest.fn((args: unknown) => args);
    const deleteMany = jest.fn(() => Promise.resolve({ count: 0 }));
    const transaction = jest.fn((ops: unknown[]) => Promise.resolve(ops));
    const prisma = {
      street: {
        upsert,
        deleteMany,
      },
      $transaction: transaction,
    } as unknown as PrismaClient;

    const result = await importStreetsFromBundledGeoJson(
      prisma,
      'municipio-1',
      'Passagem Franca',
      'MA',
    );

    expect(result.imported).toBe(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: 'Rua sem nome #456',
          streetType: 'Rua',
        }),
      }),
    );
  });

  it('imports unnamed dirt roads with generated names', async () => {
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              osmId: '123',
              highway: 'track',
            },
            geometry: {
              type: 'LineString',
              coordinates: [
                [-43.78, -6.18],
                [-43.781, -6.181],
              ],
            },
          },
        ],
      }),
    );

    const upsert = jest.fn((args: unknown) => args);
    const deleteMany = jest.fn(() => Promise.resolve({ count: 0 }));
    const transaction = jest.fn((ops: unknown[]) => Promise.resolve(ops));
    const prisma = {
      street: {
        upsert,
        deleteMany,
      },
      $transaction: transaction,
    } as unknown as PrismaClient;

    const result = await importStreetsFromBundledGeoJson(
      prisma,
      'municipio-1',
      'Passagem Franca',
      'MA',
    );

    expect(result.imported).toBe(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          name: 'Estrada de terra #123',
          streetType: 'Estrada de terra',
        }),
      }),
    );
    expect(deleteMany).toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
