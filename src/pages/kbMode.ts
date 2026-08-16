import {
  PLATFORM_LABELS,
  type ContentSource,
  type ContentState,
  type Platform,
  type PublicationView,
} from '../api/content';

/**
 * 内容展示状态是按发布记录聚合出来的（D18），不是存下来的。
 * 口径必须和 Java `ContentState.aggregate` 一致：无记录=未发布；有记录且无 hot=已发布；任一 hot=爆款。
 */
export function aggregateContentState(pubs: Pick<PublicationView, 'state'>[]): ContentState {
  if (pubs.length === 0) return 'unpublished';
  if (pubs.some((p) => p.state === 'hot')) return 'hot';
  return 'published';
}

/** 平台生成稿只能回创作页改（D16），库内编辑入口只给「我传的」。 */
export function canEditInLibrary(source: ContentSource): boolean {
  return source === 'manual';
}

export function isLibraryEmpty(items: { id: number }[]): boolean {
  return items.length === 0;
}

export function platformLabel(p: Platform | string | null | undefined): string {
  if (!p) return '—';
  return (PLATFORM_LABELS as Record<string, string>)[p] ?? p;
}
