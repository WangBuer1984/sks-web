/** 把档案里任意形状的值渲染成一行文本——LLM 可能给字符串、数组或对象。
 * 从 Positioning.tsx 抽出共享，DRY。 */
export function asText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}：${asText(val)}`)
      .join('；');
  }
  return String(v);
}

/** 剥一层 profile：/step done 时 draft = {profile:{...}, a_cards:[]}，
 *  取 draft.profile（内层档案对象）。扁平或 null 时降级返回 draft 本身 / {}。 */
export function extractProfileContent(draft: unknown): Record<string, unknown> {
  if (draft == null || typeof draft !== 'object') return {};
  const d = draft as Record<string, unknown>;
  const inner = d['profile'];
  if (inner && typeof inner === 'object' && Object.keys(inner as object).length > 0) {
    return inner as Record<string, unknown>;
  }
  return d;
}
