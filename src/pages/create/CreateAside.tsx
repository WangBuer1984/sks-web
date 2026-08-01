import { Link } from 'react-router-dom';
import type { CardSummary } from '../../api/kb';
import type { ScriptDetail, ScriptSummary } from '../../api/script';

/**
 * 创作页右栏——对齐原型 13 段 genDone 右栏：引用知识卡片（B 层）+ 「下划线即引用」提示 +
 * 历史稿件（B 保留真功能）。令牌化。
 */
export default function CreateAside({
  script,
  bCards,
  history,
}: {
  script: ScriptDetail;
  bCards: CardSummary[];
  history: ScriptSummary[];
}) {
  return (
    <aside className="flex flex-col gap-3">
      <div className="text-copy font-bold text-paper-inkSoft">本稿引用的知识卡片</div>
      {script.citedCardIds.length === 0 ? (
        <p className="text-meta text-paper-muted">本稿未引用知识卡。</p>
      ) : (
        script.citedCardIds.map((cid) => {
          const c = bCards.find((x) => x.id === cid);
          return (
            <div key={cid} className="rounded-panel border border-paper-line bg-paper-card px-4 py-3.5">
              <div className="mb-1.5 text-hint font-bold text-paper-primary">{c ? c.cardType : `卡 #${cid}`}</div>
              <div className="mb-1 text-body font-medium text-paper-ink">{c ? c.title : `卡 #${cid}`}</div>
              <div className="text-meta leading-normal text-paper-muted">
                {c ? c.content.slice(0, 40) : '—'}
              </div>
            </div>
          );
        })
      )}
      <div className="rounded-panel border border-dashed border-paper-goldSoft bg-paper-tint px-4 py-3 text-caption leading-normal text-paper-primary">
        引用卡片来自知识库 B 层；发现信息过时？去「知识库」更新。
      </div>

      <div className="text-copy font-bold text-paper-inkSoft">历史稿件</div>
      {history.length === 0 ? (
        <p className="text-meta text-paper-muted">暂无草稿稿件。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {history.map((s) => (
            <li key={s.id}>
              <Link
                to="/review"
                className="block rounded-card border border-paper-line bg-paper-base px-2.5 py-1.5 text-meta text-paper-ink hover:bg-paper-tint"
              >
                #{s.id} · {s.platform} · {s.reviewState}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
