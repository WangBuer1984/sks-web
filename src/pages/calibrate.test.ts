import { describe, expect, it } from 'vitest';
import { asText, extractProfileContent } from '../lib/profileText';
import {
  currentStep,
  extractFaqCandidates,
  selectedFaqInputs,
  shouldApplySampleResponse,
  shouldShowSampleBlock,
  storeTurns,
  toggleCandidate,
  type SampleState,
} from './calibrateMode';

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

describe('extractFaqCandidates', () => {
  it('从 summarize draft 取 faq_candidates', () => {
    const draft = {
      profile: { persona: '工厂人' },
      faq_candidates: [
        { question: '报价为什么差一倍', answer: '看板材与五金' },
        { question: '工期能压到多短' },
      ],
    };
    expect(extractFaqCandidates(draft)).toEqual([
      { question: '报价为什么差一倍', answer: '看板材与五金' },
      { question: '工期能压到多短' },
    ]);
  });

  it('没有候选 / 旧 checkpoint（只有 a_cards）→ 空数组，不报错', () => {
    expect(extractFaqCandidates({ profile: { 人设: 'x' }, a_cards: [{ title: 't' }] })).toEqual([]);
    expect(extractFaqCandidates(null)).toEqual([]);
    expect(extractFaqCandidates({ faq_candidates: 'not-an-array' })).toEqual([]);
  });

  it('丢掉 question 空白的脏候选（勾了也没法入库）', () => {
    expect(
      extractFaqCandidates({ faq_candidates: [{ question: '  ' }, { question: '真问题' }] }),
    ).toEqual([{ question: '真问题' }]);
  });

  it('answer 空白 → 不带 answer 键（后端把它当「答案后补」）', () => {
    expect(extractFaqCandidates({ faq_candidates: [{ question: 'q', answer: '  ' }] })).toEqual([
      { question: 'q' },
    ]);
  });
});

describe('toggleCandidate', () => {
  it('勾选 / 取消勾选按下标切换', () => {
    expect(toggleCandidate([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleCandidate([0, 1, 2], 1)).toEqual([0, 2]);
  });
});

describe('selectedFaqInputs', () => {
  const candidates = [
    { question: 'q0', answer: 'a0' },
    { question: 'q1' },
    { question: 'q2' },
  ];

  it('只回勾中的候选，按候选原顺序', () => {
    expect(selectedFaqInputs(candidates, [2, 0])).toEqual([{ question: 'q0', answer: 'a0' }, { question: 'q2' }]);
  });

  it('一条没勾 → []（confirm 仍照常提交，FAQ 不是校准前置条件）', () => {
    expect(selectedFaqInputs(candidates, [])).toEqual([]);
  });

  it('越界下标忽略', () => {
    expect(selectedFaqInputs(candidates, [9])).toEqual([]);
  });
});

describe('shouldApplySampleResponse', () => {
  it('reqId===latest 且未 abort → true', () =>
    expect(shouldApplySampleResponse(3, 3, false)).toBe(true));
  it('reqId 过期 → false', () => expect(shouldApplySampleResponse(2, 3, false)).toBe(false));
  it('aborted → false（即使 id 匹配）', () =>
    expect(shouldApplySampleResponse(3, 3, true)).toBe(false));
});
