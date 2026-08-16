import type { InterviewHistoryView, PendingVoiceSuggestion } from '../api/profile';

/** Positioning aside 回放面板是否渲染气泡（否则降级占位）。 */
export function shouldShowReplay(
  found: boolean,
  turns: InterviewHistoryView['turns'] | null,
): boolean {
  return !!(found && turns && turns.length > 0);
}

/** 定位页建议条正文：必须写明「点确认才写入」，不能暗示已经改了档案。 */
export function voiceSuggestText(s: PendingVoiceSuggestion): string {
  const bits: string[] = [];
  if (s.tone?.trim()) bits.push(`口吻改成「${s.tone.trim()}」`);
  if (s.redlines?.trim()) bits.push(`红线改成「${s.redlines.trim()}」`);
  const what = bits.join('，并把');
  return `复盘后建议把${what}——点确认才写入档案，AI 不会悄悄改。`;
}

/** 档案项「报价拆解 40%」→ 名称 + 数字。无数字则纯名称。 */
export function parseContentPillar(raw: string): { name: string; amount: number | null; hadPercent: boolean } {
  const s = raw.trim();
  const m = s.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(%)?$/);
  if (!m) return { name: s, amount: null, hadPercent: false };
  const amount = Number(m[2]);
  if (!Number.isFinite(amount) || amount < 0) return { name: s, amount: null, hadPercent: false };
  return { name: m[1].trim() || s, amount, hadPercent: m[3] === '%' };
}

/** 旧「支柱配比」常被写成光秃秃的 5:3:2，没有类目名。展示时套原型四类，不回写。 */
const FALLBACK_PILLAR_NAMES = ['行业揭秘', '避坑清单', '客户案例', '产品种草'] as const;

const BARE_RATIO = /^\d+(?:\.\d+)?(?:\s*[:：/\-]\s*\d+(?:\.\d+)?)+$/;

function splitPillarBlob(s: string): string[] {
  const text = s.trim();
  if (!text) return [];
  if (BARE_RATIO.test(text)) {
    return text.split(/\s*[:：/\-]\s*/).map((w, i) => `${FALLBACK_PILLAR_NAMES[i] ?? `支柱${i + 1}`} ${w}`);
  }
  const bySep = text.split(/\s*[·、，,;；/|+]\s*|\n+/).map((x) => x.trim()).filter(Boolean);
  if (bySep.length >= 2) return bySep;
  const named = text.split(/\s*[:：]\s*/).map((x) => x.trim()).filter(Boolean);
  if (named.length >= 2 && named.every((c) => /^.+\s+\d+(?:\.\d+)?\s*%?$/.test(c))) {
    return named;
  }
  const spaced = text.split(/\s+/).filter((p) => /^[\u4e00-\u9fffA-Za-z0-9]{2,12}$/.test(p));
  if (spaced.length >= 2) return spaced;
  return [text];
}

/** 单条旧文案拆成多行。数组里每一项都拆，避免「整段写在一行」变成一条 100%。 */
export function expandPillarItems(items: string[] | string | null | undefined): string[] {
  const list = Array.isArray(items)
    ? items
    : typeof items === 'string' && items.trim()
      ? [items.trim()]
      : [];
  return list.flatMap(splitPillarBlob);
}

/** 无占比时按顺序递减，4 条对齐原型 40 / 30 / 20 / 10。只用于展示。 */
export function defaultPillarWeights(n: number): number[] {
  if (n <= 0) return [];
  const preset: Record<number, number[]> = {
    1: [100],
    2: [60, 40],
    3: [50, 30, 20],
    4: [40, 30, 20, 10],
  };
  if (preset[n]) return preset[n];
  const raw = Array.from({ length: n }, (_, i) => n - i);
  const sum = raw.reduce((a, b) => a + b, 0);
  const pcts = raw.map((w) => Math.round((w / sum) * 100));
  pcts[pcts.length - 1] += 100 - pcts.reduce((a, b) => a + b, 0);
  return pcts;
}

function scaleToHundred(amounts: number[]): number[] {
  const sum = amounts.reduce((a, b) => a + b, 0);
  if (sum <= 0) return defaultPillarWeights(amounts.length);
  const pcts = amounts.map((w) => Math.round((w / sum) * 100));
  pcts[pcts.length - 1] += 100 - pcts.reduce((a, b) => a + b, 0);
  return pcts;
}

/** 定位页支柱条。有明确百分数用百分数；4:3 当权重；全没数字则按顺序递减。不回写档案。 */
export function pillarDisplayRows(items: string[]): { name: string; pct: number }[] {
  const parsed = expandPillarItems(items)
    .map(parseContentPillar)
    .filter((p) => p.name);
  if (parsed.length === 0) return [];
  const numbered = parsed.filter((p) => p.amount != null);
  if (numbered.length === 0) {
    const weights = defaultPillarWeights(parsed.length);
    return parsed.map((p, i) => ({ name: p.name, pct: weights[i] }));
  }
  const amounts = parsed.map((p) => p.amount ?? 0);
  const sum = amounts.reduce((a, b) => a + b, 0);
  const allPercent = numbered.length === parsed.length && parsed.every((p) => p.hadPercent);
  if (allPercent && Math.abs(sum - 100) <= 2) {
    return parsed.map((p) => ({ name: p.name, pct: Math.max(0, Math.min(100, p.amount ?? 0)) }));
  }
  return parsed.map((p, i) => ({ name: p.name, pct: scaleToHundred(amounts)[i] }));
}

/** 原型四色条，顺序：主色 / 金 / 绿 / 蓝。 */
export const PILLAR_BAR_HEX = ['#8a5a2b', '#c89a5e', '#4a8c5c', '#4a6c8c'] as const;
