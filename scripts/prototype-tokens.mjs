#!/usr/bin/env node
/**
 * 从原型的 inline 样式里聚合设计令牌，并与 tailwind.config.js 现有色板比对。
 *
 * 为什么要这一步：原型 body 里有 730 处 `style="..."`、0 处 `class=`，两个 <style> 块中一个是
 * 505 条 @font-face、另一个只有 7 行——**没有任何类选择器**，即没有可移植的样式表。
 * 所以令牌只能从 inline 样式反推。靠眼睛比对必然漏，这里把它变成可枚举、可核对的频次表：
 * 出现多次的值才是真令牌，只出现一次的通常是局部微调。
 *
 * 依赖 scripts/extract-prototype.mjs 的产物。用法：node scripts/prototype-tokens.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FULL = join(ROOT, 'prototypes', 'extracted', 'full.html');
const OUT = join(ROOT, 'prototypes', 'extracted', 'TOKENS.md');

if (!existsSync(FULL)) {
  console.error('缺 prototypes/extracted/full.html —— 先跑 node scripts/extract-prototype.mjs');
  process.exit(1);
}

const html = readFileSync(FULL, 'utf8');
// 只看 body：<head> 里那 521KB 是内嵌字体，混进来会污染统计
const body = html.slice(html.indexOf('<body'));

// 同时收 style-hover：原型把 hover 态写在这个自定义属性里（如侧边栏 hover #3a382f），
// 只解析 style= 会漏掉整套交互态颜色——而 hover 也是保真的一部分。
const decls = [];
for (const m of body.matchAll(/style(?:-hover)?="([^"]*)"/g)) {
  for (const part of m[1].split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const val = part.slice(i + 1).trim();
    if (prop && val) decls.push({ prop, val });
  }
}

function tally(list) {
  const map = new Map();
  for (const v of list) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const byProp = new Map();
for (const { prop, val } of decls) {
  if (!byProp.has(prop)) byProp.set(prop, []);
  byProp.get(prop).push(val);
}

/**
 * 颜色归一化。必须做：原型大量写 `#fff` 而 tailwind.config 写 `#ffffff`，
 * 不归一化会把同一个颜色报成「config 里没有、需新增」——统计一错，后面照着补令牌就全歪了。
 */
function normColor(c) {
  const s = c.toLowerCase().replace(/\s+/g, '');
  const m = /^#([0-9a-f]{3})$/.exec(s);
  return m ? `#${[...m[1]].map((ch) => ch + ch).join('')}` : s;
}

// 颜色：从所有声明里抠出 #rgb/#rrggbb 与 rgba()，不限于 color 属性（border/background 里也有）
const colors = tally(
  decls.flatMap(({ val }) => [
    ...(val.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
    ...(val.match(/rgba?\([^)]*\)/g) ?? []),
  ].map(normColor)),
);

const { default: twConfig } = await import(join(ROOT, 'tailwind.config.js'));
const twColors = new Map();
(function flatten(obj, path = []) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (typeof v === 'string') twColors.set(normColor(v), [...path, k].join('.'));
    else flatten(v, [...path, k]);
  }
})(twConfig.theme?.extend?.colors);

const INTEREST = [
  ['font-size', '字号'],
  ['font-weight', '字重'],
  ['border-radius', '圆角'],
  ['letter-spacing', '字距'],
  ['gap', '栅格间距'],
  ['padding', '内边距'],
  ['box-shadow', '阴影'],
  ['line-height', '行高'],
];

const lines = [
  '# 原型设计令牌（自动生成，勿手改）',
  '',
  '由 `node scripts/prototype-tokens.mjs` 生成，数据源是 `extracted/full.html` 的 body inline 样式。',
  '',
  `样式声明总数 **${decls.length}** 条，来自 **${[...body.matchAll(/style="/g)].length}** 处 \`style="..."\`。`,
  '原型无任何 class 选择器，令牌全部由此反推。**出现 ≥3 次的值才建议进 tailwind.config**，',
  '只出现 1 次的多为局部微调，照搬会把令牌表撑烂。',
  '',
  '## 颜色',
  '',
  '`现有令牌` 列为空 = tailwind.config 里没有，需新增。',
  '',
  '| 色值 | 出现次数 | 现有令牌 |',
  '|---|---|---|',
  ...colors.map(([c, n]) => `| \`${c}\` | ${n} | ${twColors.get(c) ? `\`paper.${twColors.get(c).split('.').pop()}\`` : ''} |`),
  '',
  '### 与现有 tailwind.config 的冲突',
  '',
];

const twOnly = [...twColors.entries()].filter(([hex]) => !colors.some(([c]) => c === hex));
if (twOnly.length) {
  lines.push('以下令牌在 tailwind.config 里有，但原型**一次都没用过**——值可能与原型不一致，需人工核对后校准：');
  lines.push('');
  for (const [hex, path] of twOnly) lines.push(`- \`${path}\` = \`${hex}\``);
} else {
  lines.push('无——现有令牌的色值原型都在用。');
}
lines.push('');

for (const [prop, label] of INTEREST) {
  const vals = byProp.get(prop);
  if (!vals?.length) continue;
  lines.push(`## ${label}（\`${prop}\`）`, '', '| 值 | 出现次数 |', '|---|---|');
  for (const [v, n] of tally(vals)) lines.push(`| \`${v}\` | ${n} |`);
  lines.push('');
}

writeFileSync(OUT, lines.join('\n'));

console.log(`声明 ${decls.length} 条 / 不同颜色 ${colors.length} 种`);
console.log(`缺令牌的高频色（≥3 次且 config 里没有）：`);
for (const [c, n] of colors.filter(([c, n]) => n >= 3 && !twColors.has(c))) {
  console.log(`  ${c}  ×${n}`);
}
console.log(`config 有但原型未用：${twOnly.map(([h, p]) => `${p}=${h}`).join('  ') || '（无）'}`);
console.log(`→ ${OUT.replace(ROOT + '/', '')}`);
