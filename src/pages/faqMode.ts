import type { FaqView } from '../api/profile';

/** 定位页高频问答区的纯逻辑（D20）。 */

/**
 * 上移 / 下移一条，返回**整套** ids；没得移（首条上移、末条下移、id 不在列表）返回 null。
 *
 * <p>整套而不是「变动的两条」：后端要求 ids 正好是全部未删 FAQ 的一套，否则整次 4005。
 * null 用来表示「无变化」，调用方据此不发请求——点到头的那一下不该产生一次网络往返。
 */
export function moveFaq(faqs: FaqView[], id: number, dir: 'up' | 'down'): number[] | null {
  const from = faqs.findIndex((f) => f.id === id);
  if (from < 0) return null;
  const to = dir === 'up' ? from - 1 : from + 1;
  if (to < 0 || to >= faqs.length) return null;
  const ids = faqs.map((f) => f.id);
  [ids[from], ids[to]] = [ids[to], ids[from]];
  return ids;
}

/** 新增 / 编辑表单校验：只有问题必填（答案可空，先记问题、答案后补）。 */
export function faqDraftError(question: string, _answer?: string): string | null {
  return question.trim() ? null : '请填写问题';
}
