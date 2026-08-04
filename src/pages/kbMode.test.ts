import { describe, expect, it } from 'vitest';
import { isKbEmpty, partitionByLayer } from './kbMode';
import type { CardSummary } from '../api/kb';

const card = (layer: string, id: number): CardSummary =>
  ({ id, layer, cardType: 't', title: `c${id}`, content: '"x"', updatedAt: '2026-08-04T00:00:00Z' });

describe('partitionByLayer', () => {
  it('按 A/B 分组，丢弃 C', () => {
    const { a, b } = partitionByLayer([card('A', 1), card('B', 2), card('C', 3), card('A', 4)]);
    expect(a.map(c => c.id)).toEqual([1, 4]);
    expect(b.map(c => c.id)).toEqual([2]);
  });
  it('空数组 → {a:[],b:[]}', () =>
    expect(partitionByLayer([])).toEqual({ a: [], b: [] }));
});

describe('isKbEmpty', () => {
  it('A+B=0 → true', () => expect(isKbEmpty([], [])).toBe(true));
  it('A 非空 → false', () => expect(isKbEmpty([card('A', 1)], [])).toBe(false));
  it('仅有 C 不算（调用方已 partition，但保险）', () => expect(isKbEmpty([], [])).toBe(true));
});
