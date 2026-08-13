/**
 * 对标拆解页纯函数：URL 判定、计数格式化、结果文本启发式拆分。
 * 无假数据——只整理 API / 档案里已有的字符串。
 */

/** 像视频/账号链接则走 video/link；否则当粘贴文案走 video/text。 */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  if (/^(www\.)?(douyin|v\.douyin|xiaohongshu|xhslink)\./i.test(t)) return true;
  if (/weixin\.qq\.com\/sph/i.test(t)) return true;
  if (/\bv\.douyin\.com\//i.test(t)) return true;
  // 单行且无空白、含域名点号 → 倾向当链接
  if (!/\s/.test(t) && t.includes('.') && t.length < 400) return true;
  return false;
}

export function fmtCount(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

/** 时长秒 → 45秒 / 1分30秒；无则空串。 */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return '';
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}分` : `${m}分${s}秒`;
}

/** 从档案 content 取中文键，缺省空串。 */
export function profileField(content: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = content[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

/**
 * 把长 `account_profile` 拆成若干短句，供对比表「对标」列填人设/变现/频率。
 * 不够则后面行留空（不编造）。
 */
export function splitProfileSentences(text: string, max = 3): string[] {
  const t = text.trim();
  if (!t) return [];
  const parts = t
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= max) return parts.slice(0, max);
  if (parts.length === 1 && t.length > 48) {
    // 无标点长段：按逗号再切
    const byComma = t.split(/[，,]/).map((s) => s.trim()).filter(Boolean);
    if (byComma.length >= 2) return byComma.slice(0, max);
  }
  return parts.slice(0, max);
}

export type MigrationChip = {
  kind: 'good' | 'opportunity' | 'avoid' | 'plain';
  text: string;
};

/** 迁移建议拆成卡片：识别「适合/空白/别学」等关键词，否则整段 plain。 */
export function splitMigrationAdvice(text: string): MigrationChip[] {
  const t = text.trim();
  if (!t) return [];
  const lines = t
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    // 尝试按句号切开再分类
    const sentences = t
      .split(/(?<=[。！？])/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sentences.length > 1) {
      return sentences.map((s) => classifyMigrationLine(s));
    }
    return [{ kind: 'plain', text: t }];
  }
  return lines.map((s) => classifyMigrationLine(s));
}

function classifyMigrationLine(s: string): MigrationChip {
  if (/别学|不要|忌|避免|✗|×/.test(s)) return { kind: 'avoid', text: s };
  if (/空白|机会|没有竞争|独有/.test(s)) return { kind: 'opportunity', text: s };
  if (/适合|可借鉴|可复用|✓|✔/.test(s)) return { kind: 'good', text: s };
  return { kind: 'plain', text: s };
}

export type PatternBar = { label: string; count: number; pct: number };

/**
 * 从 patterns 文本里抓「标签 + N条」形态画条形图；抓不到返回空（UI 改展示原文）。
 */
export function parsePatternBars(patterns: string): PatternBar[] {
  const t = patterns.trim();
  if (!t) return [];
  const re = /([^，,。；;\n：:]{2,16}?)[：:\s]*(\d+)\s*条/g;
  const found: { label: string; count: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) != null) {
    const label = m[1].replace(/^[-·•\d.\s]+/, '').trim();
    const count = Number(m[2]);
    if (label && count > 0) found.push({ label, count });
  }
  if (found.length === 0) return [];
  const max = Math.max(...found.map((f) => f.count));
  return found.slice(0, 6).map((f) => ({
    label: f.label,
    count: f.count,
    pct: Math.round((f.count / max) * 100),
  }));
}

/** 结构长文拆成钩子/正文/CTA 三段（启发式），供左侧时间轴。 */
export function structureTimeline(structure: string): { label: string; tone: 'hook' | 'body' | 'cta' | 'plain'; text: string }[] {
  const t = structure.trim();
  if (!t) return [];
  // 已有明确分段标记
  const tagged = [
    { re: /钩子[:：]\s*(.+?)(?=(正文|承诺|清单|转化|CTA|结尾)[:：]|$)/is, label: '钩子', tone: 'hook' as const },
    { re: /正文[:：]\s*(.+?)(?=(钩子|承诺|清单|转化|CTA|结尾)[:：]|$)/is, label: '正文', tone: 'body' as const },
    { re: /(?:CTA|结尾|转化)[:：]\s*(.+?)$/is, label: '转化', tone: 'cta' as const },
  ];
  const fromTags: { label: string; tone: 'hook' | 'body' | 'cta' | 'plain'; text: string }[] = [];
  for (const g of tagged) {
    const m = t.match(g.re);
    if (m?.[1]?.trim()) fromTags.push({ label: g.label, tone: g.tone, text: m[1].trim() });
  }
  if (fromTags.length >= 2) return fromTags;

  const parts = t
    .split(/(?:→|->|｜|\n{2,})/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const labels = ['钩子', '正文', '转化', '补充'];
    const tones: Array<'hook' | 'body' | 'cta' | 'plain'> = ['hook', 'body', 'cta', 'plain'];
    return parts.slice(0, 4).map((text, i) => ({
      label: labels[i] ?? `段${i + 1}`,
      tone: tones[i] ?? 'plain',
      text,
    }));
  }
  return [{ label: '结构', tone: 'plain', text: t }];
}
