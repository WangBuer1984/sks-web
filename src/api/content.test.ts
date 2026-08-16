import { describe, it, expect } from 'vitest';
import {
  PLATFORMS,
  PLATFORM_LABELS,
  CONTENT_SOURCES,
  CONTENT_SOURCE_LABELS,
  CONTENT_STATES,
  CONTENT_STATE_LABELS,
  PUBLICATION_STATES,
  CONTENT_DETAIL_KEYS,
  CONTENT_SUMMARY_KEYS,
} from './content';
import type { ContentDetail, ContentSummary } from './content';
import { PROFILE_FIELD_KEYS, VOICE_FIELD_KEYS } from './profile';

/**
 * D18–D21 契约里被钉死的取值 + 文案。
 *
 * 这些字面量三仓共用（PG 的 CHECK 约束、Java 出参、前端渲染），文案则是产品拍板的说法——
 * 「平台生成 / 我传的」「未发布 / 已发布 / 爆款」。任何一侧漂了这里就红。
 */
describe('内容底仓契约取值', () => {
  it('平台只有抖音与视频号（小红书全站下线）', () => {
    expect(PLATFORMS).toEqual(['douyin', 'channels']);
    expect(PLATFORM_LABELS).toEqual({ douyin: '抖音', channels: '视频号' });
  });

  it('来源只有平台生成与我传的', () => {
    expect(CONTENT_SOURCES).toEqual(['manual', 'platform_generated']);
    expect(CONTENT_SOURCE_LABELS).toEqual({ manual: '我传的', platform_generated: '平台生成' });
  });

  it('内容展示状态由发布记录聚合出三态', () => {
    expect(CONTENT_STATES).toEqual(['unpublished', 'published', 'hot']);
    expect(CONTENT_STATE_LABELS).toEqual({
      unpublished: '未发布',
      published: '已发布',
      hot: '爆款',
    });
  });

  it('发布记录状态覆盖已登记与三种复盘结果', () => {
    expect(PUBLICATION_STATES).toEqual(['registered', 'hot', 'plain', 'flop']);
  });
});

/**
 * 详情与列表的字段集必须跟 Java 的 `ContentSummary` / `ContentDetail` record 以及
 * `REST_CONTRACT.md` 完全一致——TS 的 interface 编译期就没了，靠这两个常量在运行时兜住。
 *
 * 承重的一条：**详情不含 `excerpt`**（已经有全文 `body`，摘要是同一事实的第二份）。
 */
describe('内容底仓 DTO 形状', () => {
  it('列表项字段与 Java ContentSummary 对齐', () => {
    const summary: ContentSummary = {
      id: 1,
      title: '标题',
      excerpt: '摘要',
      source: 'manual',
      platform: null,
      state: 'unpublished',
      updatedAt: '2026-08-16T00:00:00+08:00',
    };
    expect(CONTENT_SUMMARY_KEYS).toEqual([
      'id',
      'title',
      'excerpt',
      'source',
      'platform',
      'state',
      'updatedAt',
    ]);
    expect(Object.keys(summary).sort()).toEqual([...CONTENT_SUMMARY_KEYS].sort());
  });

  it('详情字段与 Java ContentDetail 对齐，且不含摘要', () => {
    const detail: ContentDetail = {
      id: 1,
      title: '标题',
      body: '## 正文',
      source: 'platform_generated',
      platform: 'douyin',
      generationGroupId: 9,
      scriptId: 8,
      state: 'published',
      publications: [],
      createdAt: '2026-08-16T00:00:00+08:00',
      updatedAt: '2026-08-16T00:00:00+08:00',
    };
    expect(CONTENT_DETAIL_KEYS).toEqual([
      'id',
      'title',
      'body',
      'source',
      'platform',
      'generationGroupId',
      'scriptId',
      'state',
      'publications',
      'createdAt',
      'updatedAt',
    ]);
    expect(Object.keys(detail).sort()).toEqual([...CONTENT_DETAIL_KEYS].sort());
    expect(CONTENT_DETAIL_KEYS).not.toContain('excerpt');
  });
});

describe('定位档案字段名', () => {
  it('七个权威字段名固定', () => {
    expect(PROFILE_FIELD_KEYS).toEqual([
      'persona',
      'targetAudience',
      'differentiation',
      'conversionPath',
      'tone',
      'redlines',
      'contentPillars',
    ]);
  });

  it('创作页人设声音只投影人设/口吻/红线', () => {
    expect(VOICE_FIELD_KEYS).toEqual(['persona', 'tone', 'redlines']);
    VOICE_FIELD_KEYS.forEach((k) => expect(PROFILE_FIELD_KEYS).toContain(k));
  });
});
