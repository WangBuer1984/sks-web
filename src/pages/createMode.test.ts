import { describe, expect, it } from 'vitest';
import {
  adoptButtonLabel,
  flattenScriptMarkdown,
  platformTabLabel,
  versionForPlatform,
} from './createMode';
import type { ScriptDetail } from '../api/script';

const script = (over: Partial<ScriptDetail> = {}): ScriptDetail => ({
  id: 1,
  topicId: 9,
  hook: '{"sentences":[{"idx":0,"text":"钩"}]}',
  body: '{"sentences":[{"idx":0,"text":"正"}]}',
  cta: '{"sentences":[{"idx":0,"text":"转"}]}',
  platform: 'douyin',
  reviewState: 'draft',
  citedCardIds: [],
  dedupWarnScriptId: null,
  createdAt: '2026-08-16T00:00:00+08:00',
  updatedAt: '2026-08-16T00:00:00+08:00',
  ...over,
});

describe('versionForPlatform', () => {
  it('按平台取独立版本', () => {
    const dy = script({ id: 1, platform: 'douyin' });
    const ch = script({ id: 2, platform: 'channels' });
    expect(versionForPlatform([dy, ch], 'channels')?.id).toBe(2);
    expect(versionForPlatform([dy], 'channels')).toBeUndefined();
  });
});

describe('adoptButtonLabel', () => {
  it('按钮写明当前平台', () => {
    expect(adoptButtonLabel('douyin')).toBe('采用抖音版');
    expect(adoptButtonLabel('channels')).toBe('采用视频号版');
  });
});

describe('platformTabLabel', () => {
  it('首次切视频号提示不另扣额度', () => {
    expect(platformTabLabel('channels', true)).toContain('不另扣额度');
    expect(platformTabLabel('channels', false)).toBe('视频号版');
  });
});

describe('flattenScriptMarkdown', () => {
  it('三段拼成一篇，空段跳过', () => {
    expect(flattenScriptMarkdown(script())).toBe('钩\n\n正\n\n转');
  });
});
