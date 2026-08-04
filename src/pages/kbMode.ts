import type { CardSummary } from '../api/kb';

/** 按 layer 分 A/B 两组（丢弃 C——C 层 stat 占位，不取 CRUD 卡）。 */
export function partitionByLayer(cards: CardSummary[]): { a: CardSummary[]; b: CardSummary[] } {
  const a: CardSummary[] = [];
  const b: CardSummary[] = [];
  for (const c of cards) {
    if (c.layer === 'A') a.push(c);
    else if (c.layer === 'B') b.push(c);
  }
  return { a, b };
}

/** 空态判定：A+B=0（忽略 C）。仅有历史 C 卡仍走空态。 */
export function isKbEmpty(a: CardSummary[], b: CardSummary[]): boolean {
  return a.length + b.length === 0;
}
