import { Link } from 'react-router-dom';
import type { ContentReferenceView } from '../../api/content';
import { CONTENT_SOURCE_LABELS } from '../../api/content';

/**
 * 创作页右栏：按篇参考（取代旧 B 卡引用）+ 人设声音已在页首 VoicePanel。
 */
export default function CreateAside({
  citedContents,
}: {
  citedContents: ContentReferenceView[];
}) {
  return (
    <aside className="flex flex-col gap-3">
      <div className="text-copy font-bold text-paper-inkSoft">本稿参考了你的这些内容</div>
      {citedContents.length === 0 ? (
        <p className="text-meta text-paper-muted">本稿只基于你的定位档案。</p>
      ) : (
        citedContents.map((c) => (
          <div key={c.contentId} className="rounded-panel border border-paper-line bg-paper-card px-4 py-3.5">
            <div className="mb-1.5 text-hint font-bold text-paper-primary">
              {CONTENT_SOURCE_LABELS[c.source] ?? c.source}
            </div>
            {c.deleted ? (
              <div className="text-body text-paper-muted">内容已删除</div>
            ) : (
              <Link
                to={`/kb?content=${c.contentId}`}
                className="text-body font-medium text-paper-ink hover:text-paper-primary"
              >
                {c.title}
              </Link>
            )}
          </div>
        ))
      )}
      <div className="rounded-panel border border-dashed border-paper-goldSoft bg-paper-tint px-4 py-3 text-caption leading-normal text-paper-primary">
        参考按整篇召回；同一次生成的两个平台版本最多占用一篇。发现过时？去「知识库」更新原文。
      </div>
    </aside>
  );
}
