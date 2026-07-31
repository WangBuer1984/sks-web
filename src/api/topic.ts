import { userClient } from './client';

/**
 * 选题库（`/api/topics`，对齐 Java `TopicController` / `Topic` 实体）。
 *
 * <p>四路来源 `hot / faq / benchmark / replay`（每日热点 / 你的 FAQ / 对标拆解 / 爆款复盘）。
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
