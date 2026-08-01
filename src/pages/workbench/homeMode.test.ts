import { describe, expect, it } from 'vitest';
import {
  adoptRate,
  countSince,
  deriveHomeMode,
  homeGreeting,
  homeSub,
  weekStart,
} from './homeMode';

describe('deriveHomeMode', () => {
  it('未校准 → new', () => expect(deriveHomeMode(false)).toBe('new'));
  it('已校准 → normal', () => expect(deriveHomeMode(true)).toBe('normal'));
});

describe('homeGreeting', () => {
  it('早上带昵称', () => {
    expect(homeGreeting('王姐', new Date('2026-08-01T08:00:00'))).toBe('王姐，早上好');
  });
  it('无昵称晚上', () => {
    expect(homeGreeting(null, new Date('2026-08-01T20:00:00'))).toBe('晚上好');
  });
});

describe('homeSub', () => {
  it('new 文案含额度', () => {
    expect(homeSub('new', 10)).toContain('10');
    expect(homeSub('new', 10)).toContain('三步开始');
  });
});

describe('adoptRate', () => {
  it('空样本', () => expect(adoptRate([])).toEqual({ pct: 0, sample: 0 }));
  it('2/4 采用', () => {
    expect(adoptRate(['draft', 'pending', 'hot', 'rejected'])).toEqual({ pct: 50, sample: 4 });
  });
});

describe('countSince', () => {
  it('只计 since 之后', () => {
    const since = new Date('2026-07-28T00:00:00');
    expect(
      countSince(['2026-07-27T12:00:00', '2026-07-29T12:00:00'], since),
    ).toBe(1);
  });
});

describe('weekStart', () => {
  // 周日要回退到上一个周一，周一保持当天——用 getDay()=1 断言不依赖具体日期。
  it('结果总是周一 00:00、不晚于输入、且在一周内', () => {
    for (const d of [
      new Date('2026-08-01T10:00:00'),
      new Date('2026-08-02T22:00:00'),
      new Date('2026-08-03T03:00:00'),
    ]) {
      const s = weekStart(d);
      expect(s.getDay()).toBe(1);
      expect(s.getHours()).toBe(0);
      expect(s.getTime()).toBeLessThanOrEqual(d.getTime());
      expect(s.getTime()).toBeGreaterThan(d.getTime() - 7 * 86_400_000);
    }
  });
});
