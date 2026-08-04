import { userClient } from './client';

/**
 * 复盘 API（§4.4，Task 4.2 + 4.3）。复盘<b>免费</b>（不扣额度）。所有端点落在 C 端
 * user SecurityFilterChain（{@code /api/review/**}），token 由 userClient 拦截器自动注入。
 *
 * <ul>
 *   <li>{@code POST /api/review/{scriptId}/adopt} —— 采用：draft→pending。
 *   <li>{@code POST /api/review/{scriptId}/track} —— 登记发布链接：pending→tracking，
 *       后端抓互动数据并判态，返回 TrackResponse（hot/plain/flop）。
 *   <li>{@code POST /api/review/{scriptId}/attribute} —— 看归因（仅 flop）：返回诊断/建议。
 *   <li>{@code POST /api/review/{scriptId}/feedback} —— rejected 回访反哺：写 source=replay 选题。
 *   <li>{@code GET /api/review/weekly?week=YYYY-MM-DD} —— 周归因卡（Task 4.3）。
 * </ul>
 *
 * <p>ScriptSummary 与 listScripts 的 canonical 在 {@link ./script}，此处仅 re-export 供复盘页消费。
 */

export type { ScriptSummary } from './script';
export { listScripts } from './script';

/** track 端点响应：判态后的复盘态 + 抓回的互动指标。 */
export interface TrackResponse {
  reviewState: string;
  playCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  collectCount: number;
}

/** flop 归因视图：诊断 + 建议列表。 */
export interface AttributionView {
  diagnosis: string | null;
  suggestions: string[];
  blocked?: boolean;
}

/** 周归因 content（对齐 Java WeeklyReportMapper 写入的 JSONB）。 */
export interface WeeklyReportContent {
  summary?: string | null;
  wins?: string[];
  gaps?: string[];
  nextFocus?: string | null;
  blocked?: boolean;
}

/** 采用稿件：draft→pending。 */
export function adoptScript(scriptId: number): Promise<void> {
  return userClient.post<void, void>(`/review/${scriptId}/adopt`, {});
}

/** 登记发布链接：pending→tracking，后端抓数据并判态，返回 TrackResponse。 */
export function trackScript(scriptId: number, url: string): Promise<TrackResponse> {
  return userClient.post<TrackResponse, TrackResponse>(`/review/${scriptId}/track`, { url });
}

/** 看归因（仅 flop）：诊断 + 建议。FREE。blocked → CONTENT_BLOCKED。 */
export function attributeScript(scriptId: number): Promise<AttributionView> {
  return userClient.post<AttributionView, AttributionView>(`/review/${scriptId}/attribute`, {});
}

/** rejected 回访反哺：写 source=replay 选题。 */
export function feedbackScript(scriptId: number, reason: string): Promise<void> {
  return userClient.post<void, void>(`/review/${scriptId}/feedback`, { reason });
}

/** 取某周归因报告（week=ISO 周一 YYYY-MM-DD）。无报告 → null。 */
export function getWeeklyReport(week: string): Promise<WeeklyReportContent | null> {
  return userClient.get<WeeklyReportContent | null, WeeklyReportContent | null>(
    '/review/weekly',
    { params: { week } },
  );
}
