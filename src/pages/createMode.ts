import { PLATFORM_LABELS, type Platform } from '../api/content';
import { parseSection, type ScriptDetail } from '../api/script';

export function versionForPlatform(
  versions: ScriptDetail[],
  platform: Platform,
): ScriptDetail | undefined {
  return versions.find((v) => v.platform === platform);
}

export function adoptButtonLabel(platform: Platform): string {
  return platform === 'channels' ? '采用视频号版' : '采用抖音版';
}

export function platformTabLabel(platform: Platform, missing: boolean): string {
  const base = platform === 'channels' ? '视频号版' : '抖音口播稿';
  if (platform === 'channels' && missing) return `${base}（不另扣额度）`;
  return base;
}

export function flattenScriptMarkdown(script: Pick<ScriptDetail, 'hook' | 'body' | 'cta'>): string {
  return (['hook', 'body', 'cta'] as const)
    .map((k) => parseSection(script[k]).map((s) => s.text).join(''))
    .filter(Boolean)
    .join('\n\n');
}

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}

/** 创作页参考区脚注：去重规则说给人听，不画出 generation_group。 */
export function citedNote(count: number, platform: Platform): string {
  return (
    `按这句选题从知识库整篇检索，命中 ${count} 篇。` +
    `同一轮两个平台版最多参考一篇，优先当前平台（现在是${PLATFORM_LABELS[platform]}）。` +
    `觉得参考得不对？去知识库改或删那篇内容。`
  );
}
