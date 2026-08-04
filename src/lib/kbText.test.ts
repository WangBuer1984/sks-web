import { describe, expect, it } from 'vitest';
import { displayContent, wrapContent } from './kbText';

describe('displayContent', () => {
  it('JSON 字符串 → 原文', () =>
    expect(displayContent(JSON.stringify('说真话的工厂人'))).toBe('说真话的工厂人'));
  it('JSON 对象 → pretty', () => {
    const raw = JSON.stringify({ k: 'v', n: 2 });
    expect(displayContent(raw)).toBe(JSON.stringify({ k: 'v', n: 2 }, null, 2));
  });
  it('非 JSON → 原文', () => expect(displayContent('纯文本')).toBe('纯文本'));
  it('空 → 空', () => expect(displayContent('')).toBe(''));
});

describe('wrapContent', () => {
  it('文本 → JSON 字符串', () =>
    expect(wrapContent('hi')).toBe(JSON.stringify('hi')));
  it('解析回原文一致', () => {
    const text = '一行内容';
    expect(displayContent(wrapContent(text))).toBe(text);
  });
});
