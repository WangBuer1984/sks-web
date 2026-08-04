/** Review 页纯逻辑（照 calibrateMode.ts 模式抽离，便于 node 环境单测）。 */

import type { ScriptSummary } from '../api/script';

/**
 * 指标格式化：null/undefined → 「—」；其余按 zh-CN 本地化（千分位）。
 * 表格 5 列指标列统一走这里，避免裸 0 与「未抓到」混做一团。
 */
export function formatMetric(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('zh-CN');
}

/** 稿件历史是否为空（空态插画分支判定）。 */
export function isHistoryEmpty(scripts: ScriptSummary[]): boolean {
  return scripts.length === 0;
}
