import { describe, expect, it } from 'vitest';
import { aggregateContentState, canEditInLibrary, isLibraryEmpty, platformLabel } from './kbMode';
import type { PublicationView } from '../api/content';

const pub = (state: PublicationView['state'], id = 1): PublicationView => ({
  id,
  contentId: 1,
  platform: 'douyin',
  publishUrl: `https://v.douyin.com/${id}`,
  state,
  playCount: null,
  likeCount: null,
  commentCount: null,
  shareCount: null,
  collectCount: null,
  dataSource: 'manual',
  reviewedAt: null,
  createdAt: '2026-08-10T00:00:00+08:00',
  updatedAt: '2026-08-10T00:00:00+08:00',
});

/**
 * 状态是<b>聚合出来的</b>，不是存下来的（D18）。
 *
 * 前端只在「刚登记完还没重取详情」这类瞬间用它本地推算一次，口径必须和 Java 的 `ContentState.aggregate`
 * 逐字一致——两边算法漂了，用户就会看到列表说「已发布」详情说「未发布」。
 */
describe('aggregateContentState', () => {
  it('没有发布记录 → 未发布', () => expect(aggregateContentState([])).toBe('unpublished'));
  it('有记录但都没爆 → 已发布', () =>
    expect(aggregateContentState([pub('registered'), pub('plain', 2)])).toBe('published'));
  it('任一条爆款 → 爆款', () =>
    expect(aggregateContentState([pub('flop'), pub('hot', 2)])).toBe('hot'));
  it('扑街也算已发布（发过就是发过）', () =>
    expect(aggregateContentState([pub('flop')])).toBe('published'));
});

/**
 * 单一编辑现场（D16）：平台生成稿只能回创作页改。
 *
 * 库里再开一个编辑框，用户改完一处另一处就是过期副本——两边都写着同一篇的「最新版」。
 */
describe('canEditInLibrary', () => {
  it('我传的可以库内改', () => expect(canEditInLibrary('manual')).toBe(true));
  it('平台生成稿不给编辑入口', () => expect(canEditInLibrary('platform_generated')).toBe(false));
});

describe('isLibraryEmpty', () => {
  it('没有内容 → 空态', () => expect(isLibraryEmpty([])).toBe(true));
  it('有内容 → 非空', () => expect(isLibraryEmpty([{ id: 1 } as never])).toBe(false));
});

describe('platformLabel', () => {
  it('已知平台给中文', () => expect(platformLabel('channels')).toBe('视频号'));
  it('还没登记发布的手建内容不显示平台', () => expect(platformLabel(null)).toBe('—'));
});
