/**
 * 平台判定:最终权威是 sks-ai app/datasource/tikhub.py _platform_of(host 级,
 * 只认 douyin / wechat_channels)。本文件白名单是它的子集(支持集)+ 超集(识别集含
 * 小红书,仅用于分类报错、绝不放行)。改这里前先看 _platform_of。
 */

export type PlatformId = 'douyin' | 'wechat_channels' | 'xiaohongshu';
export type ExtractedUrl = { url: string; platform: PlatformId };

/** 识别集 host(判定「这是链接不是文案」+ 提取;含小红书,多出的仅用于分类报错)。 */
export const IDENTIFY_HOSTS = [
  'douyin.com', 'iesdouyin.com', 'v.douyin.com', 'www.douyin.com',
  'weixin.qq.com', 'channels.weixin.qq.com', 'mp.weixin.qq.com',
  'xiaohongshu.com', 'www.xiaohongshu.com', 'xhslink.com',
];

/** 支持集(放行拆解)——必须是 _platform_of 返回域 {douyin, wechat_channels} 的子集。 */
export const SUPPORTED_PLATFORMS = new Set<PlatformId>(['douyin', 'wechat_channels']);

// URL-safe ASCII(RFC 3986 unreserved + reserved,不含空格/CJK),遇中文/全角即断
const URL_CHARS = String.raw`[A-Za-z0-9\-._~:/?#\[\]@!$&'()*+,;=%]`;
const SCHEME_RE = new RegExp(`https?://${URL_CHARS}+`, 'gi');
const SCHEMELESS_RE = new RegExp(
  `\\b(?:${IDENTIFY_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})/${URL_CHARS}+`,
  'gi',
);

/** 从脏分享文本提取第一个识别集平台 URL;没有返回 null。 */
export function extractShareUrl(text: string): ExtractedUrl | null {
  if (!text || !text.trim()) return null;
  SCHEME_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SCHEME_RE.exec(text)) != null) {
    const e = classify(stripTrailingPunct(m[0]), false);
    if (e) return e;
  }
  SCHEMELESS_RE.lastIndex = 0;
  while ((m = SCHEMELESS_RE.exec(text)) != null) {
    const e = classify(stripTrailingPunct(m[0]), true);
    if (e) return e;
  }
  return null;
}

function classify(token: string, schemeless: boolean): ExtractedUrl | null {
  // 畸形百分号转义(如 %zz)→ 跳过继续找,与 Java 侧 URI 等价(new URL 不抛,故显式判)
  if (/%(?![0-9A-Fa-f]{2})/i.test(token)) return null;
  const url = schemeless ? 'https://' + token : token;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null; // 畸形候选跳过
  }
  if (!host) return null;
  host = host.toLowerCase();
  if (host.endsWith('douyin.com') || host.endsWith('iesdouyin.com')) return { url, platform: 'douyin' };
  if (host.endsWith('weixin.qq.com')) return { url, platform: 'wechat_channels' };
  if (host.endsWith('xiaohongshu.com') || host.endsWith('xhslink.com')) return { url, platform: 'xiaohongshu' };
  return null;
}

/** 裁尾部 ASCII 标点(.,;:)]}>),不动 path(抖音短链 302 对尾斜杠敏感)。 */
function stripTrailingPunct(token: string): string {
  let end = token.length;
  while (end > 0) {
    const c = token.charCodeAt(end - 1);
    // . , ; : ) ] } >
    if (c === 46 || c === 44 || c === 59 || c === 58 || c === 41 || c === 93 || c === 125 || c === 62) {
      end--;
    } else break;
  }
  return token.slice(0, end);
}

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

export type VideoRoute =
  | { kind: 'videoLink'; url: string }
  | { kind: 'text'; text: string }
  | { kind: 'error'; message: string };

export type LinkValidation = { ok: true; url: string } | { ok: false; message: string };

/** 拆视频 tab 路由：提取优先。命中支持集→videoLink；识别但不支持→硬拒；否则 looksLikeUrl→videoLink；纯文案→text。 */
export function routeVideoInput(text: string): VideoRoute {
  const ex = extractShareUrl(text);
  if (ex && SUPPORTED_PLATFORMS.has(ex.platform)) return { kind: 'videoLink', url: ex.url };
  if (ex) return { kind: 'error', message: '目前仅支持抖音、视频号，小红书暂不支持' };
  if (looksLikeUrl(text)) return { kind: 'videoLink', url: text };
  return { kind: 'text', text };
}

/** 拆账号 / 复盘登记 入口校验：提取 + 支持集过滤。 */
export function validateLinkInput(text: string): LinkValidation {
  const ex = extractShareUrl(text);
  if (!ex) return { ok: false, message: '未识别到支持的平台链接，请直接粘贴抖音或视频号分享文案' };
  if (!SUPPORTED_PLATFORMS.has(ex.platform)) return { ok: false, message: '目前仅支持抖音、视频号，小红书暂不支持' };
  return { ok: true, url: ex.url };
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

/**
 * 解析 `/analyze?video=<id>` 的 query 值。
 *
 * 只接受正整数串——非法值视同「无参数」，回到正常输入态而不是拿脏 id 去打接口。
 */
export function videoDetailIdFromParam(raw: string | null | undefined): number | null {
  const t = (raw ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
