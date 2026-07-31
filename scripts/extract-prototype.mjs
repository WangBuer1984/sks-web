#!/usr/bin/env node
/**
 * 把 prototypes/随口说原型-*.html 还原成可读、可 grep、可逐段对照的文件。
 *
 * 为什么需要这一步：那个 14MB 的原型文件里，真正的页面标记是**一整行 JSON 转义字符串**
 * （668KB，`\n` / `\u002F` 全是转义的），另有一行 14.2MB 是 gzip+base64 的 JS 资源。
 * 直接对着原文件做保真等于让人手动翻一个 668KB 的单行——这正是「照着原型写还是会漏」的来源。
 * 还原后是 5471 行正常 HTML，其中 App 标记只占约 1400 行，每段还能单独切出来。
 *
 * 产出（prototypes/extracted/）：
 *   full.html        完整还原（含 505 条 @font-face 内嵌字体，约 655KB，gitignored）
 *   sections/*.html  按段切分的**平衡片段**，每个都是自包含元素，可单独打开预览
 *   SECTIONS.md      段 → sc-if 条件 → 原文行号 → 现有 React 页面 的对照索引
 *
 * 用法：node scripts/extract-prototype.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'prototypes', '随口说原型-07191700.html');
const OUT = join(ROOT, 'prototypes', 'extracted');

/** 段 → 现有 React 实现的映射。null = 无对应路由（待建）。 */
const REACT_MAP = {
  顶栏: null,
  Hero: null,
  四环节: null,
  技术: null,
  '价格 + CTA': null,
  侧边栏: null,
  主区域: null,
  工作台: 'src/pages/Workbench.tsx  (/)',
  个人中心: null,
  校准对话: 'src/pages/Calibrate.tsx  (/calibrate)',
  账号定位: null,
  选题库: null,
  文案创作: 'src/pages/Create.tsx  (/create)',
  对标拆解: 'src/pages/Analyze.tsx  (/analyze)',
  知识库: 'src/pages/KB.tsx  (/kb)',
  历史稿件: 'src/pages/Review.tsx  (/review) —— 原型此段标题为「发布复盘」，需核覆盖度',
};

/**
 * 从容器文件里取出真正的 HTML。
 * 容器是「资源映射 + 页面源码」的单文件存档：某一行是完整的 JSON 字符串字面量，即页面源码。
 * 不硬编码行号——按「最长的、能被 JSON.parse 成以 <!DOCTYPE 开头的字符串」来认，避免原型另存后行号漂移。
 */
function restoreHtml(raw) {
  const candidates = raw
    .split('\n')
    .map((line, i) => ({ line: line.trim(), no: i + 1 }))
    .filter((c) => c.line.startsWith('"') && c.line.endsWith('"'))
    .sort((a, b) => b.line.length - a.line.length);
  for (const c of candidates) {
    try {
      const html = JSON.parse(c.line);
      if (typeof html === 'string' && html.trimStart().startsWith('<!DOCTYPE')) {
        return { html, sourceLine: c.no };
      }
    } catch {
      /* 不是合法 JSON 字符串，继续试下一个 */
    }
  }
  throw new Error('未能在容器文件里定位页面源码——原型导出格式可能变了，需重看 restoreHtml');
}

/**
 * 从 startIdx（必须指向 '<'）起，取出标签配平的完整元素。
 * 只按该标签名计深度：段的包裹元素是 <sc-if> 或 <div>，两者都不会自闭合，
 * 故无需处理 <img>/<br> 这类空元素。
 */
function sliceBalanced(html, startIdx) {
  const name = /^<([a-zA-Z][\w-]*)/.exec(html.slice(startIdx, startIdx + 40))?.[1];
  if (!name) throw new Error(`位置 ${startIdx} 不是元素起始`);
  const re = new RegExp(`<${name}(?=[\\s>/])|</${name}\\s*>`, 'g');
  re.lastIndex = startIdx;
  let depth = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return { text: html.slice(startIdx, m.index + m[0].length), tag: name };
  }
  throw new Error(`<${name}> 在 ${startIdx} 处未配平`);
}

function slug(name, i) {
  const ascii = name
    .replace(/[^\w\u4e00-\u9fa5+]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${String(i).padStart(2, '0')}-${ascii}`;
}

const raw = readFileSync(SRC, 'utf8');
const { html, sourceLine } = restoreHtml(raw);
const lines = html.split('\n');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'sections'), { recursive: true });
writeFileSync(join(OUT, 'full.html'), html);

// 只把缩进 ≤ 4 的注释当段边界：更深的（步骤1/2/3、拆账号、①②③④、拆视频）是子段，留在父段文件内。
const markers = [];
lines.forEach((ln, idx) => {
  const m = /^(\s*)<!--\s*(.+?)\s*-->\s*$/.exec(ln);
  if (m && m[1].length <= 4) markers.push({ name: m[2], indent: m[1].length, line: idx + 1 });
});

const rows = [];
markers.forEach((mk, i) => {
  // 段的元素起点 = 注释行之后第一个 '<'
  const afterComment = lines.slice(0, mk.line).join('\n').length + 1;
  const startIdx = html.indexOf('<', afterComment);
  const { text, tag } = sliceBalanced(html, startIdx);
  const cond = /^<sc-if\s+value="\{\{\s*([\w]+)\s*\}\}"/.exec(text)?.[1] ?? '';
  const endLine = mk.line + text.split('\n').length;

  // 容器段（如「主区域」包住后面 9 个 App 段）只输出开标签：否则它会把子段内容整份复制一遍，
  // 两处副本迟早不一致，而对做外壳有用的信息只是它自己那层的样式（padding / overflow 等）。
  const wrapped = markers.filter((o) => o.line > mk.line && o.line < endLine).map((o) => o.name);
  const openTag = text.slice(0, text.indexOf('>') + 1);
  const body = wrapped.length
    ? `${openTag}\n  <!-- 此处内容见分段文件：${wrapped.join('、')} -->\n</${tag}>`
    : text;

  // 自检：非容器段必须标签配平，否则切出来的片段无法单独预览，等于白做。
  if (!wrapped.length) {
    const opens = (text.match(new RegExp(`<${tag}(?=[\\s>/])`, 'g')) ?? []).length;
    const closes = (text.match(new RegExp(`</${tag}\\s*>`, 'g')) ?? []).length;
    if (opens !== closes) {
      throw new Error(`段「${mk.name}」<${tag}> 未配平（开 ${opens} / 闭 ${closes}）`);
    }
  }

  const file = `${slug(mk.name, i + 1)}.html`;
  writeFileSync(
    join(OUT, 'sections', file),
    `<!-- 段：${mk.name}${cond ? `　条件：{{ ${cond} }}` : ''}${wrapped.length ? '　（容器段，仅存开标签）' : ''}\n`
      + `     来源：prototypes/随口说原型-07191700.html 第 ${sourceLine} 行内嵌页面源码的第 ${mk.line}–${endLine} 行\n`
      + `     本文件由 scripts/extract-prototype.mjs 生成，勿手改 -->\n${body}\n`,
  );
  rows.push({
    name: mk.name, cond, tag, line: mk.line, endLine, file,
    lines: body.split('\n').length, wrapped,
  });
});

const md = [
  '# 原型分段索引（自动生成，勿手改）',
  '',
  '由 `node scripts/extract-prototype.mjs` 生成。改原型后重跑本脚本。',
  '',
  `源文件：\`prototypes/随口说原型-07191700.html\`（页面源码在第 ${sourceLine} 行的 JSON 字符串里）`,
  `还原后：${lines.length} 行；其中前约 4080 行是 505 条 \`@font-face\` 内嵌字体，App 标记从 4084 行起。`,
  '',
  '`<sc-if value="{{ isXxx }}">` 是原型的显隐条件，等价于一份路由/状态表——建 React 路由时可直接对照。',
  '',
  '| # | 段 | 显隐条件 | 包裹标签 | 原文行 | 行数 | 分段文件 | 现有 React 实现 |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map((r, i) => `| ${i + 1} | ${r.name}${r.wrapped.length ? '（容器）' : ''} | ${r.cond ? `\`${r.cond}\`` : '—' } | \`${r.tag}\` | ${r.line}–${r.endLine} | ${r.lines} | \`sections/${r.file}\` | ${REACT_MAP[r.name] ?? '**缺**'} |`),
  '',
].join('\n');
writeFileSync(join(OUT, 'SECTIONS.md'), md);

console.log(`还原：第 ${sourceLine} 行 → ${lines.length} 行 HTML`);
console.log(`分段：${rows.length} 段 → ${join('prototypes', 'extracted', 'sections')}`);
for (const r of rows) {
  console.log(`  ${r.file.padEnd(26)} ${String(r.lines).padStart(4)} 行  ${r.cond || '—'}`);
}
