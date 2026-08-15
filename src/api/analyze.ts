import { userClient } from './client';

/**
 * 拆解相关接口（对齐 Java AnalyzeController，§4.3）。
 *
 * 三种模式：
 * - video/text（同步）：粘文案 → 结构化拆解，扣 1，一次返回。
 * - video/link（异步）：粘链接 → 返回 taskId，轮询 GET /tasks/{id}。
 * - account（异步）：粘账号 → precheck → 扣 10 条 → 返回 taskId，轮询。
 *
 * 无流式（硬不变量）：异步任务前端轮询 GET /tasks/{id}，进度直写 analyze_task。
 */

/** 拆视频（粘文案）同步结果：{structure, why_hot, framework, diff_hint}。 */
export interface VideoTextResponse {
  structure: string;
  whyHot: string;
  framework: string;
  diffHint: string;
}

/** 异步任务受理：{taskId}。 */
export interface TaskAccepted {
  taskId: number;
}

/** 拆账号 TOP10 明细行。structure 为 JSON 文本（structure/why_hot/framework/diff_hint）。 */
export interface BenchmarkVideoView {
  id: number;
  title: string;
  playCount: number | null;
  favCount: number | null; // 收藏（= collectCount）
  transcript: string | null;
  structure: string | null;
  createdAt: string;
  description?: string | null;
  tags?: string | null; // JSON 数组字符串
  publishedAt?: string | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  collectCount?: number | null;
  durationSec?: number | null;
}

/**
 * 单条明细详情（`GET /api/analyze/videos/{id}`，对齐 Java `BenchmarkVideoDetail`）。
 *
 * 拆视频页详情态数据源：读拆账号时已落库的转写全文 + 四字段结构化，**免费不重跑**。
 * `videoUrl` 为 `null` 表示无法构造原视频链接（视频号，或 V9 之前写入的旧行）。
 */
export interface BenchmarkVideoDetail {
  id: number;
  title: string | null;
  author: string | null;
  videoUrl: string | null;
  transcript: string | null;
  structure: string | null; // 四字段 JSON 文本
  description: string | null;
  tags: string | null; // JSON 数组字符串
  publishedAt: string | null;
  durationSec: number | null;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  collectCount: number | null;
  /** 已随拆账号汇入选题库时为该选题 id（详情态据此显示「已存入选题库」终态），否则 null。 */
  topicId: number | null;
  createdAt: string;
}

/** 拆账号三层 result（解析自 analyze_task.result JSONB）。 */
export interface AccountResult {
  account_profile?: string;
  patterns?: string;
  migration_advice?: string;
  videos?: {
    title: string;
    play_count?: number;
    like_count?: number;
    comment_count?: number;
    share_count?: number;
    collect_count?: number;
    fav_count?: number;
    description?: string;
    tags?: string[];
    published_at?: number | null;
    duration_sec?: number | null;
  }[];
}

/** 任务详情（对齐 AnalyzeController.TaskDetail）。result 为 JSON 文本。 */
export interface TaskDetail {
  id: number;
  taskType: string;
  status: string; // queued / running / done / partial / failed
  progress: number;
  charged: number;
  result: string | null;
  error: string | null;
  updatedAt: string;
  createdAt: string;
  videos: BenchmarkVideoView[];
  /** 入参 url（从 analyze_task.input 解析的干净归一化地址）。切走再切回回填输入框用。 */
  url: string | null;
}

/** 拆视频（粘文案）——同步，扣 1。 */
export function analyzeVideoText(transcript: string): Promise<VideoTextResponse> {
  return userClient.post<VideoTextResponse, VideoTextResponse>('/analyze/video/text', { transcript });
}

/** 拆视频（粘链接）——异步，扣 1，返回 taskId。 */
export function analyzeVideoLink(url: string): Promise<TaskAccepted> {
  return userClient.post<TaskAccepted, TaskAccepted>('/analyze/video/link', { url });
}

/** 拆账号——异步，固定扣 10 条（ACCOUNT_CHARGE），返回 taskId。 */
export function analyzeAccount(url: string): Promise<TaskAccepted> {
  return userClient.post<TaskAccepted, TaskAccepted>('/analyze/account', { url });
}

/** 各模式扣费（条/次）——后端传，前端不写死。 */
export interface Costs {
  videoText: number;
  videoLink: number;
  account: number;
}

/** GET /api/analyze/costs：各模式扣费条数。前端查此显示 + 余额不足判定。 */
export function getCosts(): Promise<Costs> {
  return userClient.get<Costs, Costs>('/analyze/costs');
}

/** 任务详情（轮询进度/结果，IDOR 校验）。 */
export function getAnalyzeTask(id: number): Promise<TaskDetail> {
  return userClient.get<TaskDetail, TaskDetail>(`/analyze/tasks/${id}`);
}

/** 明细详情（详情态；跨用户 / 不存在 → 后端 PARAM_INVALID）。 */
export function getBenchmarkVideo(id: number): Promise<BenchmarkVideoDetail> {
  return userClient.get<BenchmarkVideoDetail, BenchmarkVideoDetail>(`/analyze/videos/${id}`);
}

/** 安全解析 result JSON 文本为三层对象；非法 / 空 → null。 */
export function parseAccountResult(json: string | null | undefined): AccountResult | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AccountResult;
  } catch {
    return null;
  }
}

/** 安全解析四字段 JSON 文本。`transcript` 仅链接流 result 有（拆账号明细的 structure 没有）。 */
export function parseStructure(json: string | null | undefined): {
  structure?: string;
  why_hot?: string;
  framework?: string;
  diff_hint?: string;
  transcript?: string;
} | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as {
      structure?: string;
      why_hot?: string;
      framework?: string;
      diff_hint?: string;
      transcript?: string;
    };
  } catch {
    return null;
  }
}
