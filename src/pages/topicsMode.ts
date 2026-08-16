/** 选题库「刚刚生成」高亮：只认 ?fresh=id，不另开状态机。 */

export function freshTopicIdFromSearch(search: string): number | null {
  const raw = new URLSearchParams(search.startsWith('?') ? search : `?${search}`).get('fresh');
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function isFreshTopic(id: number, freshId: number | null): boolean {
  return freshId != null && id === freshId;
}

/** `?fresh=` 指向的选题不在当前待拍列表（已采用 / 已删 / 不在本页）。 */
export function isFreshMissing<T extends { id: number }>(
  topics: T[],
  freshId: number | null,
): boolean {
  return freshId != null && !topics.some((t) => t.id === freshId);
}

export function orderTopicsWithFresh<T extends { id: number }>(
  topics: T[],
  freshId: number | null,
): T[] {
  if (freshId == null) return topics;
  const i = topics.findIndex((t) => t.id === freshId);
  if (i <= 0) return topics;
  const next = topics.slice();
  const [hit] = next.splice(i, 1);
  return [hit, ...next];
}
