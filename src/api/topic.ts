import { userClient } from './client';

/**
 * 选题库（`/api/topics`，对齐 Java `TopicController` / `Topic` 实体）。
 *
 * <p>四路来源 `hot / faq / benchmark / replay`（历史热点 / 你的 FAQ / 对标拆解 / 爆款复盘）。
 * `GET` 不传 `source` 即聚合四路、按 `pillar` 排序；传其一则单路过滤。
 */

/** 选题四路来源。 */
export type TopicSource = 'hot' | 'faq' | 'benchmark' | 'replay';

/** 选题（字段名对齐 Java 实体，axios 层不做 snake/camel 转换）。 */
export interface Topic {
  id: number;
  userId: number;
  source: TopicSource | string;
  title: string;
  rationale: string | null;
  pillar: string | null;
  status: string;
  /** 关联的拆账号明细 id：仅 benchmark 来源且标题对得上时有值——据它显示「看文案」入口。 */
  benchmarkVideoId: number | null;
  /** 来源 FAQ 的 id：仅「由 FAQ 生成选题」产生时有值（手建的 faq 选题为 null）。 */
  faqId: number | null;
  /**
   * 生成选题时的问题快照。**不是 join 出来的最新问题**——FAQ 改名不回写已生成选题，
   * 记的是「当时问的是什么」。存量选题为 null。
   */
  faqQuestionSnapshot: string | null;
  /** 来源 FAQ 是否已被删除（后端查询时算的派生值）。为 true 时选题照常可用，只是标注一下。 */
  faqDeleted: boolean;
  createdAt: string;
}

/** 选题列表。`source` 省略 = 聚合四路。 */
export function listTopics(source?: TopicSource): Promise<Topic[]> {
  return userClient.get<Topic[], Topic[]>('/topics', {
    params: source ? { source } : undefined,
  });
}

/** 选题详情。跨用户访问后端返回 PARAM_INVALID（不泄露存在性）。 */
export function getTopic(id: number): Promise<Topic> {
  return userClient.get<Topic, Topic>(`/topics/${id}`);
}

/** 新建选题（title 过 UGC 内容安全；source 缺省 faq）。返回新建 id。 */
export function createTopic(
  title: string,
  rationale?: string,
  source?: TopicSource,
): Promise<number> {
  return userClient.post<number, number>('/topics', { title, rationale, source });
}

