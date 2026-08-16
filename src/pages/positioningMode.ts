import type { InterviewHistoryView, PendingVoiceSuggestion } from '../api/profile';

/** Positioning aside 回放面板是否渲染气泡（否则降级占位）。 */
export function shouldShowReplay(
  found: boolean,
  turns: InterviewHistoryView['turns'] | null,
): boolean {
  return !!(found && turns && turns.length > 0);
}

/** 定位页建议条正文：必须写明「点确认才写入」，不能暗示已经改了档案。 */
export function voiceSuggestText(s: PendingVoiceSuggestion): string {
  const bits: string[] = [];
  if (s.tone?.trim()) bits.push(`口吻改成「${s.tone.trim()}」`);
  if (s.redlines?.trim()) bits.push(`红线改成「${s.redlines.trim()}」`);
  const what = bits.join('，并把');
  return `复盘后建议把${what}——点确认才写入档案，AI 不会悄悄改。`;
}
