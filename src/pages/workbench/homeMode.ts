export type HomeMode = 'new' | 'normal';

export function deriveHomeMode(calibrated: boolean): HomeMode {
  return calibrated ? 'normal' : 'new';
}

export function homeGreeting(nickname: string | null | undefined, now = new Date()): string {
  const h = now.getHours();
  const slot = h >= 5 && h < 11 ? '早上' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上';
  const name = nickname?.trim();
  return name ? `${name}，${slot}好` : `${slot}好`;
}

export function homeSub(mode: HomeMode, balance: number): string {
  if (mode === 'new') {
    return `三步开始，把「像你」的底子打好 · 剩余额度 ${balance} 条`;
  }
  return `今天也继续产出 · 剩余额度 ${balance} 条`;
}

export function weekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x;
}

export function countSince(isoDates: string[], since: Date): number {
  const t = since.getTime();
  return isoDates.filter((s) => {
    const ms = Date.parse(s);
    return !Number.isNaN(ms) && ms >= t;
  }).length;
}

const ADOPTED = new Set(['pending', 'tracking', 'hot', 'plain', 'flop']);

export function adoptRate(states: string[]): { pct: number; sample: number } {
  const sample = states.length;
  if (sample === 0) return { pct: 0, sample: 0 };
  const hit = states.filter((s) => ADOPTED.has(s)).length;
  return { pct: Math.round((hit / sample) * 100), sample };
}
