import type { InterviewHistoryView } from '../api/profile';

/** Positioning aside 回放面板是否渲染气泡（否则降级占位）。 */
export function shouldShowReplay(
  found: boolean,
  turns: InterviewHistoryView['turns'] | null,
): boolean {
  return !!(found && turns && turns.length > 0);
}
