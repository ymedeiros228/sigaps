import { mapFamilyIds } from './admin.service';

// Árvore: root → (a, b); a → a1. Cada conta tem o seu mapa; a Equipe vê a família toda.
const PARENT: Record<string, string | null> = { root: null, a: 'root', b: 'root', a1: 'a', other: null };

const prisma = {
  municipality: {
    findUnique: jest.fn(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id in PARENT ? { parentId: PARENT[where.id] } : null),
    ),
    findMany: jest.fn(({ where }: { where: { parentId: { in: string[] } } }) =>
      Promise.resolve(
        Object.keys(PARENT)
          .filter((id) => where.parentId.in.includes(PARENT[id] as string))
          .map((id) => ({ id })),
      ),
    ),
  },
};

describe('mapFamilyIds', () => {
  it.each(['root', 'a', 'b', 'a1'])('a partir de %s acha a família inteira', async (start) => {
    const ids = await mapFamilyIds(prisma as never, start);
    expect(ids.sort()).toEqual(['a', 'a1', 'b', 'root']);
  });

  it('não mistura outro município', async () => {
    expect(await mapFamilyIds(prisma as never, 'other')).toEqual(['other']);
  });
});
