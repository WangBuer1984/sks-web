import { describe, expect, it } from 'vitest';
import { asText, extractProfileContent } from '../lib/profileText';
import { currentStep, shouldShowSampleBlock, storeTurns, type SampleState } from './calibrateMode';

describe('currentStep', () => {
  it('materials → 1', () => expect(currentStep('materials')).toBe(1));
  it('await_feedback → 2', () => expect(currentStep('await_feedback')).toBe(2));
  it('ask → 2', () => expect(currentStep('ask')).toBe(2));
  it('summarize → 2', () => expect(currentStep('summarize')).toBe(2));
  it('done → 3', () => expect(currentStep('done')).toBe(3));
});

describe('extractProfileContent', () => {
  it('嵌套 draft → 剥一层 profile', () => {
    const draft = { profile: { 人设: '工厂人', 人群: '业主' }, a_cards: [] };
    expect(extractProfileContent(draft)).toEqual({ 人设: '工厂人', 人群: '业主' });
  });
  it('扁平 draft（兼容降级）', () => {
    expect(extractProfileContent({ 人设: 'x' })).toEqual({ 人设: 'x' });
  });
  it('null → {}', () => expect(extractProfileContent(null)).toEqual({}));
  it('profile 为空对象 → 降级到原 draft', () => {
    // draft.profile 是 {}  falsy → 回退 draft 本身
    expect(extractProfileContent({ profile: {}, 人设: 'y' })).toEqual({ profile: {}, 人设: 'y' });
  });
});

describe('asText', () => {
  it('字符串原样', () => expect(asText('hi')).toBe('hi'));
  it('数组用 · 连接', () => expect(asText(['a', 'b'])).toBe('a · b'));
  it('对象键值串', () => expect(asText({ k: 'v' })).toBe('k：v'));
  it('null → 空', () => expect(asText(null)).toBe(''));
});

describe('shouldShowSampleBlock', () => {
  const ok = (o: Partial<SampleState>): SampleState =>
    ({ found: false, topic: '', without: null, with: null, ...o } as SampleState);
  it('found 且两 hook 非空 → true', () =>
    expect(shouldShowSampleBlock(ok({ found: true, without: 'a', with: 'b' }))).toBe(true));
  it('found=false → false', () =>
    expect(shouldShowSampleBlock(ok({ found: false, without: 'a', with: 'b' }))).toBe(false));
  it('缺 with → false', () =>
    expect(shouldShowSampleBlock(ok({ found: true, without: 'a', with: null }))).toBe(false));
  it('null → false', () => expect(shouldShowSampleBlock(null)).toBe(false));
});

describe('storeTurns', () => {
  it('done 快照非空 → 用快照（不含幽灵 turn）', () =>
    expect(storeTurns(['a', 'b'], ['a', 'b', 'ghost'])).toEqual(['a', 'b']));
  it('done null → 用 live', () => expect(storeTurns(null, ['a', 'b'])).toEqual(['a', 'b']));
  it('done 空数组 → 用空快照（不 fallback live）', () => expect(storeTurns([], ['a'])).toEqual([]));
});
