import { describe, expect, it } from 'vitest';
import {
  freshTopicIdFromSearch,
  isFreshMissing,
  isFreshTopic,
  orderTopicsWithFresh,
} from './topicsMode';

describe('freshTopicIdFromSearch', () => {
  it('读 ?fresh= 正整数', () => {
    expect(freshTopicIdFromSearch('?fresh=42')).toBe(42);
    expect(freshTopicIdFromSearch('?q=1&fresh=7')).toBe(7);
  });

  it('缺省 / 非法 → null', () => {
    expect(freshTopicIdFromSearch('')).toBeNull();
    expect(freshTopicIdFromSearch('?fresh=abc')).toBeNull();
    expect(freshTopicIdFromSearch('?fresh=0')).toBeNull();
  });
});

describe('isFreshTopic', () => {
  it('id 对上才高亮', () => {
    expect(isFreshTopic(9, 9)).toBe(true);
    expect(isFreshTopic(9, 8)).toBe(false);
    expect(isFreshTopic(9, null)).toBe(false);
  });
});

describe('orderTopicsWithFresh', () => {
  it('刚生成的置顶，其余顺序不变', () => {
    const topics = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(orderTopicsWithFresh(topics, 2).map((t) => t.id)).toEqual([2, 1, 3]);
    expect(orderTopicsWithFresh(topics, null).map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it('fresh 不在当前列表 → 顺序不变', () => {
    const topics = [{ id: 1 }, { id: 2 }];
    expect(orderTopicsWithFresh(topics, 42).map((t) => t.id)).toEqual([1, 2]);
  });
});

describe('isFreshMissing', () => {
  it('带了 fresh 但列表里没有 → true', () => {
    expect(isFreshMissing([{ id: 1 }], 42)).toBe(true);
    expect(isFreshMissing([{ id: 42 }], 42)).toBe(false);
    expect(isFreshMissing([{ id: 1 }], null)).toBe(false);
  });
});
