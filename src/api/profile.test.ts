import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  confirmProfile,
  createFaq,
  createTopicFromFaq,
  deleteFaq,
  listFaqs,
  reorderFaqs,
  updateFaq,
  updateProfileFields,
  type FaqView,
  type InterviewTurn,
} from './profile';
import { userClient } from './client';

vi.mock('./client', () => ({
  userClient: {
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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
      faqs: null,
    });
  });

  it('turns omitted → body turns: null (向后兼容旧前端)', async () => {
    vi.mocked(userClient.post).mockResolvedValue(undefined);
    await confirmProfile('sess-2');
    expect(userClient.post).toHaveBeenCalledWith('/profile/confirm', {
      sessionId: 'sess-2',
      turns: null,
      faqs: null,
    });
  });

  it('只提交用户勾选的 FAQ 候选（没勾的候选不入库）', async () => {
    vi.mocked(userClient.post).mockResolvedValue(undefined);
    await confirmProfile('sess-3', undefined, [
      { question: '报价为什么差一倍', answer: '看板材与五金' },
      { question: '工期能压到多短' },
    ]);
    expect(userClient.post).toHaveBeenCalledWith('/profile/confirm', {
      sessionId: 'sess-3',
      turns: null,
      faqs: [
        { question: '报价为什么差一倍', answer: '看板材与五金' },
        { question: '工期能压到多短' },
      ],
    });
  });

  it('一条没勾 → faqs: []（不是不传：显式表达「用户看过候选、都不要」）', async () => {
    vi.mocked(userClient.post).mockResolvedValue(undefined);
    await confirmProfile('sess-4', undefined, []);
    expect(userClient.post).toHaveBeenCalledWith('/profile/confirm', {
      sessionId: 'sess-4',
      turns: null,
      faqs: [],
    });
  });
});

describe('updateProfileFields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('PUT /profile/fields，body 就是要改的字段子集（部分更新）', async () => {
    vi.mocked(userClient.put).mockResolvedValue({
      calibrated: true,
      version: 1,
      calibratedAt: null,
      content: {},
    });
    await updateProfileFields({ tone: '更犀利一点' });
    expect(userClient.put).toHaveBeenCalledWith('/profile/fields', { tone: '更犀利一点' });
  });

  it('创作页「人设声音」只提交三项投影，不带其余四项', async () => {
    vi.mocked(userClient.put).mockResolvedValue({
      calibrated: true,
      version: 1,
      calibratedAt: null,
      content: {},
    });
    await updateProfileFields({ persona: '工厂人', tone: '直白', redlines: ['不诋毁同行'] });
    const body = vi.mocked(userClient.put).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['persona', 'redlines', 'tone']);
  });
});

describe('FAQ API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('列表：GET /profile/faqs', async () => {
    const rows: FaqView[] = [
      { id: 1, question: '报价为什么差一倍', answer: null, sortOrder: 0, updatedAt: '2026-08-16' },
    ];
    vi.mocked(userClient.get).mockResolvedValue(rows);
    await expect(listFaqs()).resolves.toEqual(rows);
    expect(userClient.get).toHaveBeenCalledWith('/profile/faqs');
  });

  it('新增：POST /profile/faqs，answer 省略时传 null（先记问题、答案后补）', async () => {
    vi.mocked(userClient.post).mockResolvedValue(7);
    await expect(createFaq('工期能压到多短')).resolves.toBe(7);
    expect(userClient.post).toHaveBeenCalledWith('/profile/faqs', {
      question: '工期能压到多短',
      answer: null,
    });
  });

  it('编辑：PUT /profile/faqs/{id}', async () => {
    vi.mocked(userClient.put).mockResolvedValue(undefined);
    await updateFaq(7, '工期能压到多短', '看柜体数量');
    expect(userClient.put).toHaveBeenCalledWith('/profile/faqs/7', {
      question: '工期能压到多短',
      answer: '看柜体数量',
    });
  });

  it('删除：DELETE /profile/faqs/{id}（软删，已生成的选题不受影响）', async () => {
    vi.mocked(userClient.delete).mockResolvedValue(undefined);
    await deleteFaq(7);
    expect(userClient.delete).toHaveBeenCalledWith('/profile/faqs/7');
  });

  it('排序：PUT /profile/faqs/order，提交整套 ids', async () => {
    vi.mocked(userClient.put).mockResolvedValue(undefined);
    await reorderFaqs([3, 1, 2]);
    expect(userClient.put).toHaveBeenCalledWith('/profile/faqs/order', { ids: [3, 1, 2] });
  });

  it('生成选题：POST /profile/faqs/{id}/topic → 新选题 id', async () => {
    vi.mocked(userClient.post).mockResolvedValue(42);
    await expect(createTopicFromFaq(7)).resolves.toBe(42);
    expect(userClient.post).toHaveBeenCalledWith('/profile/faqs/7/topic', {});
  });
});
