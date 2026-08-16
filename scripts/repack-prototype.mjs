#!/usr/bin/env node
/**
 * 把 prototypes/extracted/full.html 写回 随口说原型-07191700.html 第 N 行的 JSON 字符串。
 * 与 extract-prototype.mjs 成对：extract 拆出，repack 装回。容器其余行（gzip 资源）不动。
 *
 * 用法：node scripts/repack-prototype.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = join(ROOT, 'prototypes', '随口说原型-07191700.html');
const INNER = join(ROOT, 'prototypes', 'extracted', 'full.html');

function findSourceLine(raw) {
  const lines = raw.split('\n');
  let best = { i: -1, len: 0 };
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s.startsWith('"') || !s.endsWith('"') || s.length < 10_000) continue;
    try {
      const html = JSON.parse(s);
      if (typeof html === 'string' && html.trimStart().startsWith('<!DOCTYPE') && s.length > best.len) {
        best = { i, len: s.length };
      }
    } catch {
      /* 不是页面源码 */
    }
  }
  if (best.i < 0) throw new Error('未能在容器里定位页面源码行');
  return best.i;
}

const raw = readFileSync(BUNDLE, 'utf8');
const inner = readFileSync(INNER, 'utf8');
if (!inner.trimStart().startsWith('<!DOCTYPE')) {
  throw new Error('extracted/full.html 不是以 <!DOCTYPE 开头，拒绝装回');
}
const lines = raw.split('\n');
const idx = findSourceLine(raw);
// 斜杠必须写成 \u002F：源码里有 </script>，JSON.stringify 默认不转义 /，
// 浏览器会把容器的 <script type="__bundler/template"> 提前关掉，解包报 Unterminated string。
const packed = JSON.stringify(inner).replace(/\//g, '\\u002F');
if (/<\/script/i.test(packed)) {
  throw new Error('装回结果仍含 </script>，容器解包会被截断');
}
lines[idx] = packed;
writeFileSync(BUNDLE, lines.join('\n'));
console.log(`装回：extracted/full.html → 第 ${idx + 1} 行（${packed.length} 字符）`);
