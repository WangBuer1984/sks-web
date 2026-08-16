import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateGroupVersion, generateScript } from './script';
import { userClient } from './client';

vi.mock('./client', () => ({
  userClient: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

describe('generateScript', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts GenerationView 请求形状', async () => {
    vi.mocked(userClient.post).mockResolvedValue({
      groupId: 3,
      versions: [],
      citedContents: [],
      dedupWarnScriptId: null,
    } as never);
    await generateScript(9, 'douyin', '45', '钩子-冲突');
    expect(userClient.post).toHaveBeenCalledWith('/scripts/generate', {
      topicId: 9,
      platform: 'douyin',
      duration: '45',
      framework: '钩子-冲突',
    });
  });
});

describe('generateGroupVersion', () => {
  beforeEach(() => vi.clearAllMocks());

  it('懒生成走 groups/:id/versions?platform=', async () => {
    vi.mocked(userClient.post).mockResolvedValue({ id: 2 } as never);
    await generateGroupVersion(3, 'channels');
    expect(userClient.post).toHaveBeenCalledWith('/scripts/groups/3/versions', {}, {
      params: { platform: 'channels' },
    });
  });
});
