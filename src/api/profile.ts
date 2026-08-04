import { userClient } from './client';

/**
 * 定位校准 API（Task 2.2）。校准免费（PRD §4.2），无额度逻辑。
 * 所有端点落在 C 端 user SecurityFilterChain（/api/profile/**），token 由 userClient 拦截器自动注入。
 */

/**
 * /api/profile/interview 响应（对齐 Java InterviewStepView）。
 * - stage: guess_persona / await_feedback / ask / summarize
 * - question: 本轮问题（stage=ask/await_feedback 时非空）
 * - profileDraft: summarize 完成时返回最终档案（JSON 对象）；前端据 done=true 展示 + 确认
 * - done: 图跑完（summarize 完成）
 * - blocked: UGC / LLM 产出命中安全（状态机未推进），前端提示调整后重试
 * - banner: 工作台横幅文案（PRD §11.4「校准进行中，第 X 步」）
 */
export interface InterviewStepView {
  stage: string | null;
  question: string | null;
  profileDraft: Record<string, unknown> | null;
  done: boolean;
  blocked?: boolean;
  banner?: string;
}

/** 推进访谈一轮。首轮传 materials（粘贴的素材文本）、reply 省略；后续轮传 reply、materials 省略。 */
export function interviewStep(
  sessionId: string,
  reply?: string,
  materials?: string,
): Promise<InterviewStepView> {
  return userClient.post<InterviewStepView, InterviewStepView>('/profile/interview', {
    sessionId,
    reply: reply ?? null,
    materials: materials ?? null,
  });
}

/**
 * 语音 → 文字（仅转写，不提交）。返回文本由前端回显 / 编辑后再作为 reply 走 interviewStep。
 * ASR 失败抛 BizError（前端提示改用文字输入，不阻断访谈）。
 */
export function asrVoice(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append('audio', audio, 'audio.webm');
  return userClient.post<string, string>('/profile/voice', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** 校准生效：写 active 档案 + 批量建 A 层卡。turns 入库为 content 的 _interview_turns 供回放。 */
export function confirmProfile(
  sessionId: string,
  turns?: { role: 'ai' | 'user'; text: string }[],
): Promise<void> {
  return userClient.post<void, void>('/profile/confirm', { sessionId, turns: turns ?? null });
}

/**
 * active 定位档案（对齐 Java `ProfileController.ActiveProfileView`）。
 *
 * <p>`content` 的键由 Python summarize 产出，契约为 `人设 / 人群 / 差异化 / 变现 / 红线 / 支柱配比`
 * ——**中文键**，且 prompt 迭代频繁故后端整体透传不拆字段，前端也按 `Record` 读、缺键降级显示。
 *
 * <p>未校准不是错误：`calibrated=false` + `content={}`，据此渲染引导态而非报错。
 */
export interface ActiveProfileView {
  calibrated: boolean;
  version: number | null;
  calibratedAt: string | null;
  content: Record<string, unknown>;
}

/** 读取当前用户的 active 定位档案。未校准返回 calibrated=false（非 404）。 */
export function getActiveProfile(): Promise<ActiveProfileView> {
  return userClient.get<ActiveProfileView, ActiveProfileView>('/profile');
}

/** /api/profile/sample-opening 响应（对齐 Java AiClient.SampleOpeningResponse）。 */
export interface SampleOpeningView {
  found: boolean;
  topic: string;
  without: string | null;
  with: string | null;
}

/**
 * 试试效果对比块：取「无档案/有档案」两版开场钩子。
 * sessionId 由前端生成（与 interviewStep 同一 session）；topic 省略时后端默认「报价为什么差一倍」。
 * found=false（访谈未完成）时前端按失败处理——静默隐藏对比块。
 */
export function sampleOpening(sessionId: string, topic?: string): Promise<SampleOpeningView> {
  return userClient.post<SampleOpeningView, SampleOpeningView>('/profile/sample-opening', {
    sessionId,
    topic: topic ?? null,
  });
}

/** /api/profile/interview/history 响应（对齐 Java ProfileService.InterviewHistoryView）。 */
export interface InterviewTurn {
  role: 'ai' | 'user';
  text: string;
}
export interface InterviewHistoryView {
  found: boolean;
  turns: InterviewTurn[];
}

/** 回放面板：读当前 active 档案 confirm 时入库的访谈问答。未校准/旧档案 → found=false。 */
export function interviewHistory(): Promise<InterviewHistoryView> {
  return userClient.get<InterviewHistoryView, InterviewHistoryView>('/profile/interview/history');
}
