import { describe, expect, it } from 'vitest';
import { shouldShowReplay, voiceSuggestText } from './positioningMode';
import type { InterviewTurn } from '../api/profile';

const t = (role: 'ai' | 'user', text: string): InterviewTurn => ({ role, text });

describe('shouldShowReplay', () => {
  it('found 且 turns 非空 → true', () =>
    expect(shouldShowReplay(true, [t('ai', 'q'), t('user', 'a')])).toBe(true));
  it('found=false → false', () =>
    expect(shouldShowReplay(false, [t('ai', 'q')])).toBe(false));
  it('turns 空 → false', () =>
    expect(shouldShowReplay(true, [])).toBe(false));
  it('turns null → false', () =>
    expect(shouldShowReplay(true, null)).toBe(false));
});

describe('voiceSuggestText', () => {
  it('口吻建议写明点确认才写入', () => {
    const t = voiceSuggestText({ tone: '先给数字，再讲故事' });
    expect(t).toContain('先给数字，再讲故事');
    expect(t).toContain('点确认才写入档案');
    expect(t).not.toContain('已写入');
  });

  it('红线建议单独成句', () => {
    const t = voiceSuggestText({ redlines: '不承诺效果' });
    expect(t).toContain('红线改成「不承诺效果」');
  });
});
