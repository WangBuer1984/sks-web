/**
 * 发布记录版复盘 API（D9 / D18）——`/api/review/publications/*` + 手动周报。
 *
 * <p>与旧 `review.ts`（稿件维度：采用 / 登记 / 反哺）的分工：这里只认发布记录。新 UI 只走这一套，
 * 旧模块保留一个兼容周期。
 *
 * <p><b>登记不在这里</b>：登记走 `content.ts` 的 `registerPublication`。这个模块里的每个调用都
 * 意味着「用户主动要一次抓数或一次归纳」——系统自己不会在任何时刻替他调。
 */

import { userClient } from './client';
import type { PublicationView } from './content';

export type { PublicationView } from './content';

/**
 * 复盘页一次取回的两半：待发布内容 + 发布记录。
 *
 * <p>`pending` 是派生的（还没有任何发布记录的内容），不是一张待发布表——拆成两个请求会出现
 * 「登记成功了但上半段还没刷新」的中间态，同一条内容会在两半里同时出现。
 */
export interface ReviewBoardView {
  pending: PendingContentView[];
  publications: PublicationView[];
}

/** 待发布的一项。`platform` 可空（手建内容还没平台标签），登记弹窗据此决定默认选中哪个平台。 */
export interface PendingContentView {
  contentId: number;
  title: string;
  source: string;
  platform: string | null;
  updatedAt: string;
}

/** flop 归因：诊断 + 建议。不改态、不扣额度。 */
export interface AttributionView {
  diagnosis: string | null;
  suggestions: string[];
  /** 口吻建议是否已写入档案 `_pending_voice`；false 时定位页不会出条幅。 */
  voiceSuggestSaved?: boolean | null;
}

/**
 * 周报 content（Java 侧写进 JSONB 的原样字段）。
 *
 * <p>`next_focus` 是 snake_case——它由 Python 的归因结果直接落库，没有在 Java 里改名。前端不要
 * 各处 `??` 兜，统一走 `pages/reviewMode.ts` 的 `normalizeWeekly`。
 */
export interface WeeklyReportRaw {
  summary?: string | null;
  wins?: string[];
  gaps?: string[];
  next_focus?: string | null;
  nextFocus?: string | null;
  blocked?: boolean;
}

/** 复盘页数据（`state` 可选，只筛发布记录那一半）。 */
export function getReviewBoard(state?: string): Promise<ReviewBoardView> {
  return userClient.get<ReviewBoardView, ReviewBoardView>('/review/publications', {
    params: state ? { state } : {},
  });
}

/** 复盘一条发布记录：抓真实五码 → 判态 → 覆盖为最新。同一条可反复点。 */
export function reviewPublication(id: number): Promise<PublicationView> {
  return userClient.post<PublicationView, PublicationView>(`/review/publications/${id}/review`, {});
}

/** 看归因（仅扑街）：返回诊断 / 建议，不改态。 */
export function attributePublication(id: number): Promise<AttributionView> {
  return userClient.post<AttributionView, AttributionView>(
    `/review/publications/${id}/attribute`,
    {},
  );
}

/** 取某周周报（week = ISO 周一 YYYY-MM-DD）。还没生成 → null。 */
export function getWeekly(week: string): Promise<WeeklyReportRaw | null> {
  return userClient.get<WeeklyReportRaw | null, WeeklyReportRaw | null>('/review/weekly', {
    params: { week },
  });
}

/** 手动生成本周复盘：聚合该周已复盘的发布记录。当周没有样本 → 4005（不产空报告）。 */
export function generateWeekly(week: string): Promise<WeeklyReportRaw> {
  return userClient.post<WeeklyReportRaw, WeeklyReportRaw>(
    '/review/weekly/generate',
    { week },
    { params: { week } },
  );
}
