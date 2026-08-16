import type { PublicationView, ReviewBoardView, WeeklyReportRaw } from '../api/publication';

export const PUBLICATION_STATE_LABELS: Record<PublicationView['state'], string> = {
  registered: '待复盘',
  hot: '爆款',
  plain: '平平',
  flop: '扑街',
};

export function formatMetric(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('zh-CN');
}

/** 是否已经抓过五码：看 reviewedAt，不看数字是否为 0。 */
export function hasMetrics(p: Pick<PublicationView, 'reviewedAt'>): boolean {
  return p.reviewedAt != null;
}

export function isBoardEmpty(board: ReviewBoardView): boolean {
  return board.pending.length === 0 && board.publications.length === 0;
}

/** 当周可生成周报的样本 = 已复盘的发布记录（只登记过的不算）。 */
export function countReviewable(board: ReviewBoardView): number {
  return board.publications.filter((p) => hasMetrics(p)).length;
}

/** 今天所在 ISO 周的周一 YYYY-MM-DD。 */
export function isoWeekStart(now = new Date()): string {
  const d = new Date(now);
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface WeeklyNormalized {
  summary: string | null;
  wins: string[];
  gaps: string[];
  nextFocus: string | null;
  blocked: boolean;
}

export function normalizeWeekly(raw: WeeklyReportRaw | null | undefined): WeeklyNormalized | null {
  if (raw == null) return null;
  return {
    summary: raw.summary ?? null,
    wins: raw.wins ?? [],
    gaps: raw.gaps ?? [],
    nextFocus: raw.nextFocus ?? raw.next_focus ?? null,
    blocked: raw.blocked === true,
  };
}
