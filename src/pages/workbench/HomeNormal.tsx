import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { topicSourceMeta } from '../../lib/topicSourceMeta';

/**
 * 工作台 `homeNormal` 态——已校准用户的常态首页。
 * 文案/间距对齐 `prototypes/extracted/sections/08-工作台.html`（`{{ homeNormal }}` 块）。
 * 与原型的差异（计划接受）：
 *   - 不渲染「账号定位还没校准」条——双态互斥：homeNormal 即已校准，该条恒为假。
 *   - 三个数字口径跟锁定原型：知识库内容 / 待用选题 / 本周已采用。不加「最近内容」「待复盘」。
 */
export interface HomeNormalProps {
  contentCount: number;
  topicCount: number;
  adoptedThisWeek: number;
  topics: {
    id: number;
    source: string;
    title: string;
    rationale: string | null;
    pillar: string | null;
    status: string;
  }[];
}

function MetricCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-panel border border-paper-line bg-paper-card px-5 py-[18px]">
      <div className="mb-2 text-meta text-paper-muted">{label}</div>
      <div className="font-serif text-title font-bold text-paper-ink">{children}</div>
    </div>
  );
}

export default function HomeNormal({
  contentCount,
  topicCount,
  adoptedThisWeek,
  topics,
}: HomeNormalProps) {
  const picks = topics.filter((t) => t.status === 'open').slice(0, 3);

  return (
    <>
      <div className="mb-[30px] grid grid-cols-3 gap-3.5">
        <MetricCard label="知识库内容">
          {contentCount}
          <span className="ml-1 text-meta font-normal text-paper-muted">篇</span>
        </MetricCard>
        <MetricCard label="待用选题">
          {topicCount}
          <span className="ml-1 text-meta font-normal text-paper-muted">条</span>
        </MetricCard>
        <MetricCard label="本周已采用">
          {adoptedThisWeek}
          <span className="ml-1 text-meta font-normal text-paper-muted">篇</span>
        </MetricCard>
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[16px] font-bold text-paper-ink">选题建议</div>
        <div className="text-meta text-paper-muted">来自你的高频问答、对标拆解与爆款复盘</div>
      </div>

      {picks.length === 0 ? (
        <div className="mb-[30px] rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black">选题库还是空的</p>
          <p className="mb-5 text-body leading-[1.8] text-paper-muted">
            在定位页把高频问答生成选题，或拆一个对标账号
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

      <div className="flex items-center gap-3.5 rounded-card border border-paper-goldPale border-l-[3px] border-l-paper-primary bg-paper-tint px-[18px] py-3.5">
        <div className="flex-1 text-[13.5px] leading-normal text-paper-ink">
          <strong>点「采用抖音版 / 采用视频号版」才会进知识库</strong>
          。只生成或只复制，库里不会多一篇。旧文案也可以粘进来。
        </div>
        <Link
          to="/kb"
          className="whitespace-nowrap rounded-chip bg-paper-primary px-4 py-2 text-copy text-white hover:bg-paper-primaryHover hover:text-white"
        >
          去知识库 →
        </Link>
      </div>
    </>
  );
}
