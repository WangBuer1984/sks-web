import { describe, expect, it } from 'vitest';
import { topicFaqOrigin } from './topicFaqOrigin';
import type { Topic } from '../api/topic';

const topic = (o: Partial<Topic>): Topic => ({
  id: 1,
  userId: 1,
  source: 'faq',
  title: '报价为什么差一倍？三个地方决定',
  rationale: null,
  pillar: null,
  status: 'open',
  benchmarkVideoId: null,
  faqId: null,
  faqQuestionSnapshot: null,
  faqDeleted: false,
  createdAt: '2026-08-16T00:00:00Z',
  ...o,
});

describe('topicFaqOrigin', () => {
  it('由 FAQ 生成 → 显示当时的问题快照', () => {
    expect(
      topicFaqOrigin(topic({ faqId: 7, faqQuestionSnapshot: '报价为什么差一倍' })),
    ).toEqual({ question: '报价为什么差一倍', deleted: false });
  });

  it('原 FAQ 已删除 → 仍显示快照并标记 deleted（选题不删）', () => {
    expect(
      topicFaqOrigin(
        topic({ faqId: 7, faqQuestionSnapshot: '报价为什么差一倍', faqDeleted: true }),
      ),
    ).toEqual({ question: '报价为什么差一倍', deleted: true });
  });

  it('手建的 faq 选题（无 faqId）→ null，不显示来源行', () => {
    expect(topicFaqOrigin(topic({ faqId: null }))).toBeNull();
  });

  it('其它来源 → null', () => {
    expect(topicFaqOrigin(topic({ source: 'hot', faqId: 7, faqQuestionSnapshot: 'q' }))).toBeNull();
  });

  it('存量选题：有 faqId 但快照为空 → 不编造问题文本，只表明来自 FAQ', () => {
    expect(topicFaqOrigin(topic({ faqId: 7, faqQuestionSnapshot: null }))).toEqual({
      question: null,
      deleted: false,
    });
  });
});
