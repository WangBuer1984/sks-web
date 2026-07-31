import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listTopics, type Topic } from '../api/topic';
import { topicSourceMeta } from '../lib/topicSourceMeta';

/**
 * 选题库 `/topics`——对齐原型「选题库」段（`prototypes/extracted/sections/12-选题库.html`，
 * 条件 `{{ isTopics }}`）。
 *
 * <p>四路来源聚合展示，每条一行：来源标签 + 标题 + 来源说明 + 「生成文案」。
 * 「生成文案」带 `?topic=<id>` 跳创作页，让创作页知道从哪个选题来。
 */

export default function Topics() {
  const navigate = useNavigate();
  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ['topics'],
    queryFn: () => listTopics(),
  });

  const list = topics ?? [];
  // status 非 open 的选题已被消耗，原型标题计数说的是「待拍选题」
  const pending = list.filter((t) => t.status === 'open');

  return (
    <div className="mx-auto max-w-[880px]">
      <h1 className="mb-1 font-serif text-title font-black">
        选题库
        <span className="ml-3 font-sans text-copy font-normal text-paper-muted">
          {isLoading ? '加载中…' : `${pending.length} 个待拍选题`}
        </span>
      </h1>
      <p className="mb-5 text-lead text-paper-muted">
        选题来自四个入口：每日热点、你的 FAQ、对标拆解、爆款复盘——都对齐你的内容支柱配比
      </p>

      {isLoading ? (
        <p className="text-copy text-paper-muted">加载中…</p>
      ) : list.length === 0 ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black">选题库还是空的</p>
          <p className="mb-5 text-body leading-[1.8] text-paper-muted">
            完成账号定位校准后，每天会自动送 3 个热点选题
            <br />
            也可以现在拆一个对标账号，立刻拿到 20 条爆款选题参考
          </p>
          <div className="flex justify-center gap-2.5">
            <Link
              to="/analyze"
              className="rounded-card bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover hover:text-white"
            >
              去拆一个对标账号
            </Link>
            <Link
              to="/positioning"
              className="rounded-card border border-paper-primary px-6 py-3 text-body text-paper-primary hover:bg-paper-tint"
            >
              先完成定位校准
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((t) => {
            const meta = topicSourceMeta(t.source);
            return (
              <div
                key={t.id}
                className="flex items-center gap-4 rounded-panel border border-paper-line bg-paper-card px-5 py-4"
              >
                <span
                  className={`whitespace-nowrap rounded-tag border px-2 py-[3px] text-hint font-bold ${meta.cls}`}
                >
                  {meta.label}
                </span>
                <div className="flex-1">
                  <div className="mb-[3px] text-[14.5px] font-medium">{t.title}</div>
                  <div className="text-meta text-paper-muted">
                    {t.rationale?.trim() || (t.pillar ? `内容支柱：${t.pillar}` : '—')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/create?topic=${t.id}`)}
                  className="whitespace-nowrap rounded-chip border border-paper-primary px-4 py-[7px] text-copy text-paper-primary hover:bg-paper-tint"
                >
                  生成文案
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3.5 rounded-panel border border-dashed border-paper-goldSoft bg-paper-tint px-[18px] py-3.5 text-caption leading-normal text-paper-primary">
        在「对标拆解」里点「存入选题库」、或在「发布复盘」里给爆款出续集，选题会自动汇入这里。
      </p>
    </div>
  );
}
