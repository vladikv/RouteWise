import { LabelMetrics, layoutLabels } from './label-layout';

/**
 * With font size 10 and dot radius 2: text width = characters × 10 × 0.6, the gap
 * from the dot = 2 + 10 × 0.25 = 4.5, and every box gets 10 × 0.4 = 4 padding.
 */
const METRICS: LabelMetrics = { fontSize: 10, dotRadius: 2 };

describe('layoutLabels', () => {
  it('puts a lone label to the right of its point', () => {
    const labels = layoutLabels([{ id: 1, x: 100, y: 100, text: 'AB' }], METRICS);

    // x = 100 + 4.5; baseline y = 100 + 10 × 0.35.
    expect(labels.get(1)).toEqual({ x: 104.5, y: 103.5, anchor: 'start', side: 'right' });
  });

  it('moves a label to the left when the right side would cover a neighbouring dot', () => {
    // "Aaaa" to the right of A spans 104.5 - 4 … 128.5 + 4; B's dot is at 118 … 122.
    const labels = layoutLabels(
      [
        { id: 1, x: 100, y: 100, text: 'Aaaa' },
        { id: 2, x: 120, y: 100, text: 'Bbbb' },
      ],
      METRICS,
    );

    expect(labels.get(1)?.side).toBe('left');
    expect(labels.get(1)?.anchor).toBe('end');
    expect(labels.get(2)?.side).toBe('right');
  });

  it('keeps neighbouring labels a padding apart: a label 14 px below another moves to the left', () => {
    // A's box ends at 100 + 5.5 + 4 = 109.5; B's right box would start at 114 - 4.5 - 4 = 105.5.
    const labels = layoutLabels(
      [
        { id: 1, x: 100, y: 100, text: 'Aa' },
        { id: 2, x: 100, y: 114, text: 'Bb' },
      ],
      METRICS,
    );

    expect(labels.get(1)?.side).toBe('right');
    expect(labels.get(2)?.side).toBe('left');
  });

  it('places pinned labels first and on their preferred side', () => {
    const labels = layoutLabels(
      [
        { id: 1, x: 100, y: 100, text: 'Other' },
        { id: 2, x: 100, y: 100, text: 'Route end', pinned: true, preferred: ['bottom'] },
      ],
      METRICS,
    );

    expect(labels.get(2)?.side).toBe('bottom');
    expect(labels.get(1)?.side).not.toBe('bottom');
  });

  it('keeps labels inside the bounds', () => {
    // "Long name" is 9 × 6 = 54 wide: on the right it would end at 153.5 > 150.
    const labels = layoutLabels([{ id: 1, x: 95, y: 50, text: 'Long name' }], {
      ...METRICS,
      bounds: { left: 0, top: 0, right: 150, bottom: 100 },
    });

    expect(labels.get(1)?.side).toBe('left');
  });

  it('hides a label that fits nowhere, but never a pinned one', () => {
    const everywhere = { left: -1000, top: -1000, right: 1000, bottom: 1000 };
    const labels = layoutLabels(
      [
        { id: 1, x: 100, y: 100, text: 'Hidden' },
        { id: 2, x: 200, y: 100, text: 'Pinned', pinned: true },
      ],
      { ...METRICS, reserved: [everywhere] },
    );

    expect(labels.get(1)).toBeNull();
    expect(labels.get(2)?.side).toBe('right');
  });

  it('never lets two placed labels overlap in a crowded cluster', () => {
    const cluster = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 100 + (i % 4) * 14,
      y: 100 + Math.floor(i / 4) * 14,
      text: `City ${i}`,
    }));
    const placed = [...layoutLabels(cluster, METRICS).values()].filter((label) => label !== null);

    // Recompute boxes from the placed positions (left edge depends on the anchor).
    const boxes = placed.map((label) => {
      const width = 6 * 10 * 0.6;
      const left =
        label!.anchor === 'start'
          ? label!.x
          : label!.anchor === 'end'
            ? label!.x - width
            : label!.x - width / 2;
      return { left, right: left + width, top: label!.y - 8, bottom: label!.y + 2 };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap =
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(overlap).toBe(false);
      }
    }
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.length).toBeLessThan(cluster.length);
  });

  it('gives a dot-only point no label but keeps its dot clear of other labels', () => {
    // "Aaaa" would fit to the right of A, but the dot-only point B sits there.
    const labels = layoutLabels(
      [
        { id: 1, x: 100, y: 100, text: 'Aaaa' },
        { id: 2, x: 120, y: 100, text: 'Bbbb', dotOnly: true },
      ],
      METRICS,
    );

    expect(labels.get(2)).toBeNull();
    expect(labels.get(1)?.side).toBe('left');
  });
});
