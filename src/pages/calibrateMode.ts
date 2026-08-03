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
