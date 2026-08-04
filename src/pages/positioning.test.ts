import { describe, expect, it } from 'vitest';
import { shouldShowReplay } from './positioningMode';
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
