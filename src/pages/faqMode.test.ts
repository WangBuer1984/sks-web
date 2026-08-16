import { describe, expect, it } from 'vitest';
import { faqDraftError, moveFaq } from './faqMode';
import type { FaqView } from '../api/profile';

const faq = (id: number, question: string, sortOrder: number): FaqView => ({
  id,
  question,
  answer: null,
  sortOrder,
  updatedAt: '2026-08-16T00:00:00Z',
});

const rows = [faq(11, 'a', 0), faq(22, 'b', 1), faq(33, 'c', 2)];

describe('moveFaq', () => {
  it('上移：交换相邻两条，返回整套 ids', () => {
    expect(moveFaq(rows, 22, 'up')).toEqual([22, 11, 33]);
  });

  it('下移同理', () => {
    expect(moveFaq(rows, 22, 'down')).toEqual([11, 33, 22]);
  });

  it('首条上移 / 末条下移 → null（无变化就不发请求）', () => {
    expect(moveFaq(rows, 11, 'up')).toBeNull();
    expect(moveFaq(rows, 33, 'down')).toBeNull();
  });

  it('id 不在列表里 → null', () => {
    expect(moveFaq(rows, 999, 'up')).toBeNull();
  });

  it('永远返回整套 ids——后端要求不缺、不重、无外来 id，半套顺序会整次 4005', () => {
    const ids = moveFaq(rows, 33, 'up');
    expect(ids).toHaveLength(rows.length);
    expect([...ids!].sort((x, y) => x - y)).toEqual([11, 22, 33]);
  });
});

describe('faqDraftError', () => {
  it('问题非空 → 无错', () => expect(faqDraftError('报价为什么差一倍')).toBeNull());
  it('问题空白 → 报错（后端 4005，前端先拦）', () =>
    expect(faqDraftError('   ')).toBeTruthy());
  it('答案可空，不影响校验', () => expect(faqDraftError('问题', '')).toBeNull());
});
