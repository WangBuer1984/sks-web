/** Calibrate 页纯逻辑（照 workbench/homeMode.ts 模式抽离，便于 node 环境单测）。 */

export type Phase = 'materials' | 'await_feedback' | 'ask' | 'summarize' | 'done';

/** sample-opening 响应形状（与 api/profile.ts 的 SampleOpeningView 对齐，本地副本避免循环依赖）。 */
export interface SampleState {
  found: boolean;
  topic: string;
  without: string | null;
  with: string | null;
}

/** phase → 三步进度条 currentStep（1/2/3）。 */
export function currentStep(phase: Phase): 1 | 2 | 3 {
  if (phase === 'materials') return 1;
  if (phase === 'done') return 3;
  return 2;
}

/** 试试效果对比块是否渲染：found 且两 hook 非空。 */
export function shouldShowSampleBlock(s: SampleState | null): boolean {
  return !!(s && s.found && s.without && s.with);
}

/**
 * 是否采纳本次 sample-opening 响应。
 *
 * <p>进 done 会触发请求；离开 done（再补充）cleanup abort + bump latestId。
 * 慢响应回来时若 reqId 已不是最新或已 abort → 丢弃，防盖掉更新结果 / 重复 LLM 竞态。
 */
export function shouldApplySampleResponse(
  reqId: number,
  latestId: number,
  aborted: boolean,
): boolean {
  return !aborted && reqId === latestId;
}

/**
 * confirm 时存哪个 turns：done 快照优先，无快照用 live。
 *
 * <p>防「再补充几句」幽灵 turn：done 后「再补充」setPhase('ask') + 乐观追加 user turn，
 * 但 sks-ai /step 幂等忽略 done 后的 reply（不 reopen）→ 该 user turn 未被消费。
 * 若 confirm 存 live turns，回放 _interview_turns 会多出未消费用户句。首次进 done 时
 * 快照（不含补充后加的 turn），confirm 存快照即可。
 */
export function storeTurns<T>(done: T[] | null, live: T[]): T[] {
  return done ?? live;
}
