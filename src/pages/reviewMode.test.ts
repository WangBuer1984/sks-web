import { describe, expect, it } from 'vitest';
import { formatMetric, isHistoryEmpty } from './reviewMode';

describe('formatMetric', () => {
  it('null → —', () => expect(formatMetric(null)).toBe('—'));
  it('undefined → —', () => expect(formatMetric(undefined)).toBe('—'));
  it('0 → 0', () => expect(formatMetric(0)).toBe('0'));
  it('1234 → 本地化', () => expect(formatMetric(1234)).toBe('1,234'));
});

describe('isHistoryEmpty', () => {
  it('空数组 → true', () => expect(isHistoryEmpty([])).toBe(true));
  it('非空 → false', () => expect(isHistoryEmpty([{ id: 1 } as any])).toBe(false));
});
