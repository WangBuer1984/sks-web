import { describe, expect, it } from 'vitest';
import {
  countReviewable,
  formatMetric,
  hasMetrics,
  isBoardEmpty,
  isoWeekStart,
  normalizeWeekly,
  PUBLICATION_STATE_LABELS,
} from './reviewMode';
import type { PublicationView, ReviewBoardView } from '../api/publication';

const pub = (over: Partial<PublicationView> = {}): PublicationView => ({
  id: 1,
  contentId: 1,
  platform: 'douyin',
  publishUrl: 'https://v.douyin.com/x',
  state: 'registered',
  playCount: null,
  likeCount: null,
  commentCount: null,
  shareCount: null,
  collectCount: null,
  dataSource: 'manual',
  reviewedAt: null,
  createdAt: '2026-08-10T00:00:00+08:00',
  updatedAt: '2026-08-10T00:00:00+08:00',
  ...over,
});

const board = (over: Partial<ReviewBoardView> = {}): ReviewBoardView => ({
  pending: [],
  publications: [],
  ...over,
});

describe('formatMetric', () => {
  it('null → —', () => expect(formatMetric(null)).toBe('—'));
  it('undefined → —', () => expect(formatMetric(undefined)).toBe('—'));
  it('0 → 0', () => expect(formatMetric(0)).toBe('0'));
  it('1234 → 本地化', () => expect(formatMetric(1234)).toBe('1,234'));
});

/**
 * 「只登记过」和「复盘出来是 0」必须能分开看。
 *
 * 两者的五码在表格里都可能是空/零，但前者要显示「复盘」按钮，后者要显示数据——靠 reviewedAt
 * 而不是靠某个数字是否为 0 来判断。
 */
describe('hasMetrics', () => {
  it('只登记过 → 没有指标', () => expect(hasMetrics(pub())).toBe(false));
  it('复盘过就算数是 0 也有指标', () =>
    expect(
      hasMetrics(pub({ state: 'flop', reviewedAt: '2026-08-12T10:00:00+08:00', playCount: 0 })),
    ).toBe(true));
  it('视频号播放量为 null 但复盘过 → 有指标', () =>
    expect(
      hasMetrics(pub({ state: 'plain', reviewedAt: '2026-08-12T10:00:00+08:00', likeCount: 30 })),
    ).toBe(true));
});

describe('复盘态文案', () => {
  it('四态各有中文说法，且不含旧的采用/追踪态', () => {
    expect(PUBLICATION_STATE_LABELS).toEqual({
      registered: '已登记',
      hot: '爆款',
      plain: '平平',
      flop: '扑街',
    });
  });
});

describe('isBoardEmpty', () => {
  it('两半都空才算空', () => expect(isBoardEmpty(board())).toBe(true));
  it('只有待发布也不算空', () =>
    expect(
      isBoardEmpty(
        board({
          pending: [
            { contentId: 1, title: '稿', source: 'manual', platform: null, updatedAt: 'x' },
          ],
        }),
      ),
    ).toBe(false));
  it('只有发布记录也不算空', () =>
    expect(isBoardEmpty(board({ publications: [pub()] }))).toBe(false));
});

/**
 * 「生成本周复盘」的可用条件 = 有已复盘的发布记录。
 *
 * 只登记没复盘的不算——后端当周无样本时返 4005，前端提前用同一口径把按钮置灰，用户就不会点出
 * 一个只能读作「系统坏了」的报错。
 */
describe('countReviewable', () => {
  it('只登记过的不计入', () => expect(countReviewable(board({ publications: [pub()] }))).toBe(0));
  it('复盘过的计入', () =>
    expect(
      countReviewable(
        board({
          publications: [
            pub({ id: 1, state: 'hot', reviewedAt: '2026-08-12T10:00:00+08:00' }),
            pub({ id: 2 }),
          ],
        }),
      ),
    ).toBe(1));
});

describe('isoWeekStart', () => {
  it('周一取自己', () => expect(isoWeekStart(new Date(2026, 7, 10))).toBe('2026-08-10'));
  it('周日回到本周一（不是下周一）', () =>
    expect(isoWeekStart(new Date(2026, 7, 16))).toBe('2026-08-10'));
  it('跨月回退', () => expect(isoWeekStart(new Date(2026, 7, 2))).toBe('2026-07-27'));
});

/**
 * 周报 JSON 的字段名在 Java 侧是 `next_focus`（Python 原样落库）。
 *
 * 前端只认一个名字就会静默丢掉「下周聚焦」那一段——页面上不报错，只是永远显示「（无建议）」。
 */
describe('normalizeWeekly', () => {
  it('snake_case 的 next_focus 能读到', () =>
    expect(normalizeWeekly({ summary: 's', next_focus: '稳住节奏' }).nextFocus).toBe('稳住节奏'));
  it('camelCase 也能读到（两侧任一改名都不至于白屏）', () =>
    expect(normalizeWeekly({ nextFocus: '稳住节奏' }).nextFocus).toBe('稳住节奏'));
  it('null → null（不是空对象）', () => expect(normalizeWeekly(null)).toBeNull());
  it('被安全拦截时保留 blocked 标记', () =>
    expect(normalizeWeekly({ blocked: true }).blocked).toBe(true));
  it('缺失的列表补成空数组', () => {
    const n = normalizeWeekly({ summary: 's' });
    expect(n.wins).toEqual([]);
    expect(n.gaps).toEqual([]);
  });
});
