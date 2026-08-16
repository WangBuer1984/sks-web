import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ContentReferenceView, Platform } from '../../api/content';
import { CONTENT_SOURCE_LABELS, listContents } from '../../api/content';
import { citedNote } from '../createMode';

/**
 * 创作页右栏参考区。生成前是占位 + 知识库可参考篇数；生成后列整篇命中。
 */
export default function CreateAside({
  citedContents,
  generated,
  platform,
}: {
  citedContents: ContentReferenceView[];
  generated: boolean;
  platform: Platform;
}) {
  const contentsQ = useQuery({
    queryKey: ['contents'],
    queryFn: () => listContents(),
    enabled: !generated,
  });
  const kbCount = contentsQ.data?.length ?? 0;

  return (
    <aside className="flex flex-col gap-3">
      <div className="text-copy font-bold text-paper-inkSoft">
        {generated ? '本稿参考了你的这些内容' : '写稿时会参考什么'}
      </div>
      {!generated ? (
        <div className="rounded-panel border border-dashed border-paper-lineStrong bg-paper-sunken px-4 py-3.5 text-caption leading-normal text-paper-muted">
          点「生成口播稿」时，AI 会按这句选题从知识库里挑最相关的 2–3 篇一起写——生成后这里会列出到底参考了哪几篇。
          <br />
          <span className="text-paper-inkSoft">
            {kbCount === 0
              ? '知识库还是空的——先粘一篇旧文案进去，稿子会更像你'
              : `知识库现有 ${kbCount} 篇可参考`}
          </span>
        </div>
      ) : citedContents.length === 0 ? (
        <div className="rounded-panel border border-dashed border-paper-lineStrong bg-paper-sunken px-4 py-3.5 text-caption leading-normal text-paper-muted">
          知识库里没有和这句选题相关的内容——
          <strong className="text-paper-inkSoft">本稿只基于你的定位档案</strong>
          。想让下一篇更像你？把相关的旧文案粘进知识库。
        </div>
      ) : (
        <>
          {citedContents.map((c) => (
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
          ))}
          <div className="rounded-panel border border-dashed border-paper-goldSoft bg-paper-tint px-4 py-3 text-caption leading-normal text-paper-primary">
            {citedNote(citedContents.length, platform)}
          </div>
        </>
      )}
    </aside>
  );
}
