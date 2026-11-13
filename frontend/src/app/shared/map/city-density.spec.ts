import { hitRadii, thinOut } from './city-density';

describe('thinOut', () => {
  interface Item {
    id: string;
    x: number;
    rank: number;
    pinned?: boolean;
  }
  const rules = (maxRank: number) => ({
    point: (item: Item) => ({ x: item.x, y: 0 }),
    rank: (item: Item) => item.rank,
    pinned: (item: Item) => item.pinned ?? false,
    maxRank,
    minDistance: 10,
  });
  const ids = (items: Item[]) => items.map((item) => item.id);

  it('drops a city above the rank limit that sits close to a kept one', () => {
    const items = [
      { id: 'big', x: 0, rank: 1 },
      { id: 'near', x: 3, rank: 3 },
      { id: 'far', x: 30, rank: 3 },
    ];

    expect(ids(thinOut(items, rules(1)))).toEqual(['big', 'far']);
  });

  it('keeps cities up to the rank limit and pinned ones, however close', () => {
    const items = [
      { id: 'a', x: 0, rank: 1 },
      { id: 'b', x: 1, rank: 2 },
      { id: 'c', x: 2, rank: 3, pinned: true },
    ];

    expect(ids(thinOut(items, rules(2)))).toEqual(['a', 'b', 'c']);
  });

  it('measures against pinned cities listed later and against cities kept in this pass', () => {
    const items = [
      { id: 'first', x: 0, rank: 3 },
      { id: 'second', x: 4, rank: 3 },
      { id: 'pin', x: 100, rank: 3, pinned: true },
      { id: 'beside-pin', x: 103, rank: 3 },
    ];

    expect(ids(thinOut(items, rules(1)))).toEqual(['first', 'pin']);
  });
});

describe('hitRadii', () => {
  it('halves the distance to the nearest neighbour within the limits', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 100, y: 0 },
      { x: 104, y: 0 },
    ];

    expect(hitRadii(points, 6.5, 17)).toEqual([10, 10, 6.5, 6.5]);
  });

  it('uses the maximum for a lone city', () => {
    expect(hitRadii([{ x: 5, y: 5 }], 6.5, 17)).toEqual([17]);
  });
});
