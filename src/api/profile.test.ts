import { describe, it, expect, vi, beforeEach } from 'vitest';
import { confirmProfile, type InterviewTurn } from './profile';
import { userClient } from './client';

vi.mock('./client', () => ({
  userClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('confirmProfile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts {sessionId, turns} body to /profile/confirm', async () => {
    vi.mocked(userClient.post).mockResolvedValue(undefined);
    const turns: InterviewTurn[] = [
      { role: 'ai', text: '猜你人设是…对吗？' },
      { role: 'user', text: '基本对' },
    ];
    await confirmProfile('sess-1', turns);
    expect(userClient.post).toHaveBeenCalledWith('/profile/confirm', {
      sessionId: 'sess-1',
      turns,
    });
  });

  it('turns omitted → body turns: null (向后兼容旧前端)', async () => {
    vi.mocked(userClient.post).mockResolvedValue(undefined);
    await confirmProfile('sess-2');
    expect(userClient.post).toHaveBeenCalledWith('/profile/confirm', {
      sessionId: 'sess-2',
      turns: null,
    });
  });
});
