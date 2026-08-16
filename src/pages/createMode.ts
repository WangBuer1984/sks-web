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
