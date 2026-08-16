/**
 * 内容底仓（知识库重构，spec 2026-08-15-kb-content-library-design D18–D21）的契约类型 + API。
 *
 * <p>知识库 = 你的内容底仓：一条 = 一篇内容。用户不需要理解「层」「卡片」「向量」；旧 A/B/C 卡片
 * 概念退场（旧 `kb.ts` 的 `/kb/cards` 保留一个兼容周期，标 deprecated）。
 *
 * <p>登记发布（`POST /kb/contents/{id}/publications`）挂在内容下而不是复盘域下：登记是「给这篇内容
 * 加一条发布记录」，抓数判态才属于复盘（见 `publication.ts`）。
 */

import { userClient } from './client';

/** 平台。D13 之后全站只剩抖音口播稿与视频号版——小红书图文形态整块下线。 */
export const PLATFORMS = ['douyin', 'channels'] as const;
export type Platform = (typeof PLATFORMS)[number];

/** 平台标签文案（创作页页签、内容列表平台标签、登记弹窗选项共用）。 */
export const PLATFORM_LABELS: Record<Platform, string> = {
  douyin: '抖音',
  channels: '视频号',
};

/**
 * 内容来源。D18：来源与发布状态<b>正交</b>——来源只说明「这篇从哪来」，不说明发没发、火没火。
 * - `platform_generated` 平台生成：点「采用当前平台版」后才入库（生成即入库的旧规则已废止）。
 * - `manual` 我传的：手写 / 粘贴的 Markdown，保存即入库。
 */
export const CONTENT_SOURCES = ['manual', 'platform_generated'] as const;
export type ContentSource = (typeof CONTENT_SOURCES)[number];

export const CONTENT_SOURCE_LABELS: Record<ContentSource, string> = {
  manual: '我传的',
  platform_generated: '平台生成',
};

/**
 * 内容展示状态——后端按发布记录聚合出的<b>派生值</b>（无记录=未发布 / 有记录=已发布 / 任一爆款=爆款）。
 * 前端只读不算；爆款不提供手工开关。
 */
export const CONTENT_STATES = ['unpublished', 'published', 'hot'] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

export const CONTENT_STATE_LABELS: Record<ContentState, string> = {
  unpublished: '未发布',
  published: '已发布',
  hot: '爆款',
};

/**
 * 单条发布记录的状态。`registered` = 只登记了链接（五码全空，系统此后不自动做任何事）；
 * 其余三态由用户点「复盘」后 Java 规则判出。
 */
export const PUBLICATION_STATES = ['registered', 'hot', 'plain', 'flop'] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

/**
 * 列表项字段名（对齐 Java `ContentSummary` 的 record 分量顺序）。
 *
 * <p>TS interface 编译后就不存在了，跨仓漂移只能靠运行时常量兜——`content.test.ts` 用它比对
 * 示例对象的键集，Java 侧用 `ContentContractTypesTest` 比对 record 分量。
 */
export const CONTENT_SUMMARY_KEYS = [
  'id',
  'title',
  'excerpt',
  'source',
  'platform',
  'state',
  'updatedAt',
] as const;

/** 详情字段名（对齐 Java `ContentDetail`）。**没有 `excerpt`**——详情已有全文 `body`。 */
export const CONTENT_DETAIL_KEYS = [
  'id',
  'title',
  'body',
  'source',
  'platform',
  'generationGroupId',
  'scriptId',
  'state',
  'publications',
  'createdAt',
  'updatedAt',
] as const;

/** 知识库列表项（对齐 Java `ContentSummary`）。`excerpt` 是正文前 200 字摘要，不是全文。 */
export interface ContentSummary {
  id: number;
  title: string;
  excerpt: string;
  source: ContentSource;
  /** 手建内容登记发布前没有平台标签 */
  platform: Platform | null;
  state: ContentState;
  updatedAt: string;
}

/**
 * 一条发布记录（对齐 Java `PublicationView`）。
 *
 * <p>登记后五码全为 null、`reviewedAt` 为 null——前端据此显示「复盘」按钮而不是数据。
 * `playCount` 即使复盘过也可能为 null（视频号拿不到播放量，归因用点赞代播放）。
 */
export interface PublicationView {
  id: number;
  contentId: number;
  platform: Platform;
  publishUrl: string;
  state: PublicationState;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  collectCount: number | null;
  dataSource: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 内容详情：列表字段 + Markdown 全文 + 该篇的全部发布记录。
 *
 * <p>一篇内容可有多条发布记录（同一手建稿分别发抖音和视频号；同平台重发也是新记录）。
 *
 * <p><b>刻意不含 `excerpt`</b>：详情已有全文 `body`，摘要是同一事实的第二份，前端无从选择显示哪个。
 * 需要摘要的场景（列表、搜索结果）用 {@link ContentSummary}。
 */
export interface ContentDetail {
  id: number;
  title: string;
  /** Markdown 正文（常规子集：标题/加粗/列表/引用/分隔线；不承诺图片与表格） */
  body: string;
  source: ContentSource;
  platform: Platform | null;
  /** 同一轮生成的两个平台版本共享生成组；手建内容为 null */
  generationGroupId: number | null;
  /** 平台生成稿的来源稿（「去创作页改」打开这一篇正文当草稿）；手建内容为 null */
  scriptId: number | null;
  state: ContentState;
  publications: PublicationView[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 右栏「本稿参考了你的这些内容」一项（取代旧「本稿引用的知识卡片」）。
 *
 * <p>按<b>篇</b>展示；`deleted=true` 时该条显示「内容已删除」，稿子本身不受影响。
 */
export interface ContentReferenceView {
  contentId: number;
  title: string;
  source: ContentSource;
  deleted: boolean;
}

/** 知识库列表筛选项。四项都可省略；省略 = 不过滤（不要传空串，后端会当成一个取值去校验）。 */
export interface ContentFilters {
  q?: string;
  source?: ContentSource;
  state?: ContentState;
  platform?: Platform;
}

/** 只保留有值的筛选项——空串会被后端按取值校验，落到 4005「内容状态不合法」。 */
function cleanParams(f: ContentFilters): Record<string, string> {
  const out: Record<string, string> = {};
  (['q', 'source', 'state', 'platform'] as const).forEach((k) => {
    const v = f[k];
    if (v != null && v !== '') out[k] = v;
  });
  return out;
}

/** 知识库列表（关键词 / 来源 / 状态 / 平台筛选，后端按更新时间倒序）。 */
export function listContents(filters: ContentFilters = {}): Promise<ContentSummary[]> {
  return userClient.get<ContentSummary[], ContentSummary[]>('/kb/contents', {
    params: cleanParams(filters),
  });
}

/** 内容详情：Markdown 全文 + 聚合状态 + 该篇全部发布记录。 */
export function getContent(id: number): Promise<ContentDetail> {
  return userClient.get<ContentDetail, ContentDetail>(`/kb/contents/${id}`);
}

/** 新建一篇「我传的」Markdown 内容。返回新内容 id。 */
export function createContent(title: string, body: string): Promise<number> {
  return userClient.post<number, number>('/kb/contents', { title, body });
}

/** 库内编辑。平台生成稿会被后端拒（4005「请去创作页改这一篇」）——前端也不该给它编辑入口。 */
export function updateContent(id: number, title: string, body: string): Promise<void> {
  return userClient.put<void, void>(`/kb/contents/${id}`, { title, body });
}

/** 创作页回写同一条（D16）：平台生成稿也允许，不新开一篇、不扣额度。 */
export function updateContentInPlace(id: number, title: string, body: string): Promise<void> {
  return userClient.put<void, void>(`/kb/contents/${id}/inplace`, { title, body });
}

/** 软删。已有的发布记录与复盘历史保留，这篇不再参与列表与检索。 */
export function deleteContent(id: number): Promise<void> {
  return userClient.delete<void, void>(`/kb/contents/${id}`);
}

/**
 * 登记发布：只存平台 + 链接，<b>不抓任何数据</b>（D9）。抓数要用户在复盘页点「复盘」。
 *
 * <p>`url` 可以直接是平台分享脏文案，后端归一化后入库。
 */
export function registerPublication(
  contentId: number,
  platform: Platform,
  url: string,
): Promise<PublicationView> {
  return userClient.post<PublicationView, PublicationView>(
    `/kb/contents/${contentId}/publications`,
    { platform, url },
  );
}
