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

/**
 * 校准生效：写 active 档案（+ 用户勾选的高频问答）。
 *
 * - `turns` 入库为 content 的 `_interview_turns` 供回放。
 * - `faqs` 只放**用户勾中**的候选（D20）：候选是 AI 从访谈里提取的，没勾的一条都不入库。
 *   传 `[]` 与不传语义不同——前者是「看过候选、都不要」，两者后端都接受（FAQ 不是校准前置条件）。
 * - D19 起后端**不再建 A 层卡**：档案本身是唯一真源。
 */
export function confirmProfile(
  sessionId: string,
  turns?: { role: 'ai' | 'user'; text: string }[],
  faqs?: FaqInput[],
): Promise<void> {
  return userClient.post<void, void>('/profile/confirm', {
    sessionId,
    turns: turns ?? null,
    faqs: faqs ?? null,
  });
}

/**
 * active 定位档案（对齐 Java `ProfileController.ActiveProfileView`）。
 *
 * <p>`content` 的规范键是 {@link PROFILE_FIELD_KEYS} 七项（D19）。**读侧仍可能遇到旧中文键**
 * （`人设 / 人群 / …`，老档案不迁移），故这里保持 `Record` 宽松类型，展示前过
 * `lib/profileFields.ts::readProfileFields` 规范化——不要在页面里直接按键取值。
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
 * signal：Calibrate 离开 done 时 abort，防慢响应盖结果。
 */
export function sampleOpening(
  sessionId: string,
  topic?: string,
  signal?: AbortSignal,
): Promise<SampleOpeningView> {
  return userClient.post<SampleOpeningView, SampleOpeningView>(
    '/profile/sample-opening',
    { sessionId, topic: topic ?? null },
    { signal },
  );
}

/**
 * 定位档案的七个权威字段名（D19：定位档案是<b>唯一真源</b>）。
 *
 * <p>不存在第二套人设卡、也不存在不可见的「创作偏好」：定位页展示完整档案，创作页「人设声音」只投影
 * {@link VOICE_FIELD_KEYS} 三项，编辑保存回写同一对象——两处改的是同一份数据。
 *
 * <p>这七个 key 同时是 `positioning_profile.content` 的 JSONB 键名与 REST 出参键名：`GET /api/profile`
 * 由服务端投影成规范键返回。**读侧仍要过 `readProfileFields`**——老档案里的旧中文键不迁移，
 * 服务端映射的是它认得的那些键，页面不该假设 `content` 里只有这七项。
 */
export const PROFILE_FIELD_KEYS = [
  'persona',
  'targetAudience',
  'differentiation',
  'conversionPath',
  'tone',
  'redlines',
  'contentPillars',
] as const;
export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

/** 创作页「人设声音」区可见可改的三项——它是生成的<b>输入</b>，生成前就要可改。 */
export const VOICE_FIELD_KEYS = ['persona', 'tone', 'redlines'] as const;
export type VoiceFieldKey = (typeof VOICE_FIELD_KEYS)[number];

/**
 * 规范化后的定位档案内容。
 *
 * <p>`redlines` / `contentPillars` 是多值（红线是清单、内容支柱是几类内容），其余五项是单段文本。
 * 全部可缺省——未校准或档案不全时按缺键降级渲染，不报错。
 */
export interface PositioningProfileContent {
  persona?: string | null;
  targetAudience?: string | null;
  differentiation?: string | null;
  conversionPath?: string | null;
  tone?: string | null;
  redlines?: string[] | null;
  contentPillars?: string[] | null;
}

/** 创作页「人设声音」的投影视图：只有三项，保存回写同一档案对象。 */
export type VoiceProfileView = Pick<PositioningProfileContent, VoiceFieldKey>;

/**
 * 改档案字段——**唯一写入路径**（D19）。传七字段的任意子集，未出现的键后端保持不变。
 *
 * <p>定位页整档编辑与创作页「人设声音」共用它，后者只提交 `persona/tone/redlines`：
 * 两处改的是同一个对象，所以「创作页改完口吻、定位页立刻可见」不靠调用方自觉。
 *
 * <p>空白文本 / 类型错误 / 未知键（含旧中文键）后端一律 4005。取消编辑时**不要**调它——
 * 草稿只在本地，不存在「边输入边污染档案」的中间态。
 *
 * <p>返回更新后的整份档案，调用方拿它 invalidate `['profile']`。
 */
export function updateProfileFields(
  patch: Partial<PositioningProfileContent>,
): Promise<ActiveProfileView> {
  return userClient.put<ActiveProfileView, ActiveProfileView>('/profile/fields', patch);
}

/**
 * 高频问答（对齐 Java `FaqView`）——属于定位档案（D20），在账号定位页维护，不在选题库维护。
 *
 * <p>`answer` 可为 null（先记问题、答案后补）；顺序由用户拖动维护，不宣称咨询频率。
 * 每条 FAQ 由用户点「生成选题」后才进入选题库。
 */
export interface FaqView {
  id: number;
  question: string;
  answer: string | null;
  sortOrder: number;
  updatedAt: string;
}

/** 新建 FAQ 的入参形状。也是 confirm 里勾选候选的形状（`answer` 缺省 = 答案后补）。 */
export interface FaqInput {
  question: string;
  answer?: string;
}

/** FAQ 列表（用户维护的顺序）。免额度。 */
export function listFaqs(): Promise<FaqView[]> {
  return userClient.get<FaqView[], FaqView[]>('/profile/faqs');
}

/** 新增 FAQ（追加到末尾）。question 过 UGC 内容安全；answer 可空。返回新 id。 */
export function createFaq(question: string, answer?: string): Promise<number> {
  return userClient.post<number, number>('/profile/faqs', {
    question,
    answer: answer ?? null,
  });
}

/** 编辑 FAQ。**已生成的选题不受影响**——选题侧存的是当时的问题快照。 */
export function updateFaq(id: number, question: string, answer?: string): Promise<void> {
  return userClient.put<void, void>(`/profile/faqs/${id}`, {
    question,
    answer: answer ?? null,
  });
}

/** 删除 FAQ（软删）。由它生成的选题**保留**，靠快照显示「原 FAQ 已删除」。 */
export function deleteFaq(id: number): Promise<void> {
  return userClient.delete<void, void>(`/profile/faqs/${id}`);
}

/**
 * 重排 FAQ。`ids` 必须是当前用户**全部**未删 FAQ 的一套（不缺、不重、无外来 id），
 * 否则后端整次 4005 且一条都不改——半套顺序比拒绝更难修。
 */
export function reorderFaqs(ids: number[]): Promise<void> {
  return userClient.put<void, void>('/profile/faqs/order', { ids });
}

/**
 * 「生成选题」：由 FAQ 建一条 open 选题（`source=faq`），后端写来源快照。返回新选题 id。
 *
 * <p>**用户主动触发**（D20）：不做后台自动生成——选题库被系统塞满的话，用户就不再看它了。
 */
export function createTopicFromFaq(id: number): Promise<number> {
  return userClient.post<number, number>(`/profile/faqs/${id}/topic`, {});
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
