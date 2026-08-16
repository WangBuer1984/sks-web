import type { Topic } from '../api/topic';

/** 选题的 FAQ 来源快照。`question` 为 null 表示存量选题没留快照——不编造问题文本。 */
export interface FaqOrigin {
  question: string | null;
  deleted: boolean;
}

/**
 * 「这条选题是从哪个 FAQ 来的」。返回 null 表示不显示来源行。
 *
 * <p>快照是**当时问的那句话**，不是 join 出来的最新问题：FAQ 改名不回写已生成选题。
 * 原 FAQ 删除后选题**保留**（软删只影响 FAQ 列表），此时 `deleted=true`，页面标一下就好——
 * 稿子已经写了、可能已经发了，把选题一起删掉才是数据丢失。
 */
export function topicFaqOrigin(topic: Topic): FaqOrigin | null {
  if (topic.source !== 'faq' || topic.faqId == null) return null;
  const question = (topic.faqQuestionSnapshot ?? '').trim();
  return { question: question || null, deleted: topic.faqDeleted === true };
}
