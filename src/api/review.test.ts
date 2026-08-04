import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackScript } from './review';
import { userClient } from './client';

vi.mock('./client', () => ({ userClient: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

describe('trackScript', () => {
  beforeEach(() => vi.clearAllMocks());
  it('posts {url} to /review/{id}/track', async () => {
    vi.mocked(userClient.post).mockResolvedValue({ reviewState: 'hot', playCount: 9, likeCount: 1, commentCount: 0, shareCount: 0, collectCount: 0 } as any);
    await trackScript(5, 'https://v.douyin.com/x');
    expect(userClient.post).toHaveBeenCalledWith('/review/5/track', { url: 'https://v.douyin.com/x' });
  });
});
