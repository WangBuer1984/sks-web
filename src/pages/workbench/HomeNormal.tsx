import { Link } from 'react-router-dom';
import { topicSourceMeta } from '../../lib/topicSourceMeta';

/**
 * 工作台 `homeNormal` 态——已校准用户的常态首页。
 * 文案/间距对齐 `prototypes/extracted/sections/08-工作台.html`（`{{ homeNormal }}` 块）。
 * 与原型的差异（计划接受）：
 *   - 不渲染「账号定位还没校准」条——双态互斥：homeNormal 即已校准，该条恒为假。
 *   - 不渲染「知识空白提醒」条——无后端信号，本期延期。
 *   - 文案采用率不造假「↑12%」环比——无环比 API；样本为 0 显示「—」。
 */
export interface HomeNormalProps {
  cardCount: number;
  cardsUpdatedThisWeek: number;
  scriptsThisWeek: number;
  adoptPct: number;
  adoptSample: number; // 0 → UI 显示「—」而非 0%
  topics: {
    id: number;
    source: string;
    title: string;
    rationale: string | null;
    pillar: string | null;
    status: string;
  }[];
}

function MetricCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-panel border border-paper-line bg-paper-card px-5 py-[18px]">
      <div className="mb-2 text-meta text-paper-muted">{label}</div>
      <div className="font-serif text-title font-bold text-paper-ink">{children}</div>
    </div>
  );
}

export default function HomeNormal({
  cardCount,
  cardsUpdatedThisWeek,
  scriptsThisWeek,
  adoptPct,
  adoptSample,
  topics,
}: HomeNormalProps) {
  const picks = topics.filter((t) => t.status === 'open').slice(0, 3);

  return (
    <>
      <div className="mb-[30px] grid grid-cols-3 gap-3.5">
        <MetricCard label="知识库卡片">
          {cardCount}
          {cardsUpdatedThisWeek > 0 && (
            <span className="ml-1 text-meta font-normal text-paper-success">+{cardsUpdatedThisWeek} 本周</span>
          )}
        </MetricCard>
        <MetricCard label="本周生成文案">
          {scriptsThisWeek}
          <span className="ml-1 text-meta font-normal text-paper-muted">条</span>
        </MetricCard>
        <MetricCard label="文案采用率">
          {adoptSample === 0 ? '—' : `${adoptPct}%`}
        </MetricCard>
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[16px] font-bold text-paper-ink">今日选题建议</div>
        <div className="text-meta text-paper-muted">基于你的账号定位 + 今日行业热点</div>
      </div>

      {picks.length === 0 ? (
        <div className="mb-[30px] rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black">选题库还是空的</p>
          <p className="mb-5 text-body leading-[1.8] text-paper-muted">
            完成账号定位校准后，每天会自动送 3 个热点选题
          </p>
          <Link
            to="/topics"
            className="rounded-card bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover hover:text-white"
          >
            去选题库看看
          </Link>
        </div>
      ) : (
        <div className="mb-[30px] flex flex-col gap-2.5">
          {picks.map((t) => {
            const meta = topicSourceMeta(t.source);
            return (
              <div
                key={t.id}
                className="flex items-center gap-4 rounded-panel border border-paper-line bg-paper-card px-5 py-4"
              >
                <span className={`whitespace-nowrap rounded-tag border px-2 py-[3px] text-hint font-bold ${meta.cls}`}>
                  {meta.label}
                </span>
                <div className="flex-1">
                  <div className="mb-[3px] text-[14.5px] font-medium text-paper-ink">{t.title}</div>
                  <div className="text-meta text-paper-muted">
                    {t.rationale?.trim() || (t.pillar ? `内容支柱：${t.pillar}` : '—')}
                  </div>
                </div>
                <Link
                  to={`/create?topic=${t.id}`}
                  className="whitespace-nowrap rounded-chip border border-paper-primary px-4 py-[7px] text-copy text-paper-primary hover:bg-paper-tint"
                >
                  生成文案
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
