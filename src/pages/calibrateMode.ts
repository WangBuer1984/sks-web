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

/** 高频问答候选（与 api/profile.ts 的 FaqInput 同形，本地副本避免循环依赖）。 */
export interface FaqCandidate {
  question: string;
  answer?: string;
}

/**
 * 从 summarize draft 取 FAQ 候选（D20）。
 *
 * <p>形状是 `{profile:{…}, faq_candidates:[{question, answer?}]}`（sks-ai `SUMMARIZE_SCHEMA`）。
 * 旧 checkpoint 没有这个键（只有中文键 profile + a_cards），拿到空数组即可——**不报错、不阻断 confirm**，
 * 用户还是能确认档案，只是没有候选可勾。
 *
 * <p>顺手洗掉脏候选：`question` 空白的勾了也没法入库（后端 4005），`answer` 空白则去掉该键，
 * 让后端按「答案后补」处理，而不是存一个空答案。
 */
export function extractFaqCandidates(draft: unknown): FaqCandidate[] {
  if (draft == null || typeof draft !== 'object') return [];
  const raw = (draft as Record<string, unknown>)['faq_candidates'];
  if (!Array.isArray(raw)) return [];
  const out: FaqCandidate[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const question = typeof o['question'] === 'string' ? o['question'].trim() : '';
    if (!question) continue;
    const answer = typeof o['answer'] === 'string' ? o['answer'].trim() : '';
    out.push(answer ? { question, answer } : { question });
  }
  return out;
}

/** 勾选 / 取消勾选一条候选（按候选数组下标）。返回升序下标集合。 */
export function toggleCandidate(selected: number[], index: number): number[] {
  const next = selected.includes(index)
    ? selected.filter((i) => i !== index)
    : [...selected, index];
  return next.sort((a, b) => a - b);
}

/**
 * 勾中的候选 → confirm 的 `faqs`，按候选原顺序（用户勾选的先后不该决定 FAQ 列表次序）。
 *
 * <p>**只提交勾中的**：没勾的候选一条都不入库——AI 提取的问题不等于用户认的问题。
 */
export function selectedFaqInputs(
  candidates: FaqCandidate[],
  selected: number[],
): FaqCandidate[] {
  return candidates.filter((_c, i) => selected.includes(i));
}
