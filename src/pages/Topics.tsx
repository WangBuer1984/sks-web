import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listTopics, type Topic } from '../api/topic';
import { topicSourceMeta } from '../lib/topicSourceMeta';
import { topicFaqOrigin } from '../lib/topicFaqOrigin';
import {
  freshTopicIdFromSearch,
  isFreshMissing,
  isFreshTopic,
  orderTopicsWithFresh,
} from './topicsMode';

/**
 * 选题库 `/topics`——对齐原型 `sections/12-选题库.html`。
 *
 * <p>行结构：来源标签 + 视频/选题标题 + 副行 t.src（拆解来源 · 播放/收藏等）+「生成文案」。
 * 指标写在 rationale（后端入库时拼好），此处解析成芯片展示。
 */

/** 从 rationale 抽出「播放/收藏/点赞」数值，剩余作来源说明。 */
function parseTopicSrc(t: Topic): {
  sourceLine: string;
  metrics: { label: string; value: string }[];
} {
  const meta = topicSourceMeta(t.source);
  const raw = (t.rationale ?? '').trim().replace(/\s+/g, ' ');
  const metrics: { label: string; value: string }[] = [];
  const re = /(播放|点赞|评论|分享|收藏)\s*([0-9.]+万?)|(时长)\s*(\d+分(?:\d+秒)?|\d+秒)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) != null) {
    if (m[1]) {
      metrics.push({ label: m[1], value: m[2] });
    } else if (m[3]) {
      metrics.push({ label: m[3], value: m[4] });
    }
  }
  // 去掉指标段，保留「对标拆解 · …」类来源
  let sourceLine = raw
    .replace(/(?:^|\s*·\s*)(?:播放|点赞|评论|分享|收藏)\s*[0-9.]+万?/g, '')
    .replace(/(?:^|\s*·\s*)时长\s*(?:\d+分(?:\d+秒)?|\d+秒)/g, '')
    .replace(/\s*·\s*$/g, '')
    .replace(/^\s*·\s*/g, '')
    .trim();
  if (!sourceLine) {
    sourceLine =
      t.pillar?.trim()
        ? `${meta.label} · 内容支柱：${t.pillar.trim()}`
        : `来自${meta.label}`;
  } else if (!sourceLine.includes(meta.label) && t.source === 'benchmark') {
    // 已是「对标拆解 · …」则不动
  }
  return { sourceLine, metrics };
}

export default function Topics() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const freshId = freshTopicIdFromSearch(params.toString());
  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ['topics'],
    queryFn: () => listTopics(),
  });

  const pending = orderTopicsWithFresh(
    (topics ?? []).filter((t) => t.status === 'open'),
    freshId,
  );

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-title font-black text-paper-ink">
          选题库{' '}
          <span className="font-sans text-copy font-normal text-paper-muted">
            {isLoading ? '加载中…' : `${pending.length} 个待拍选题`}
          </span>
        </h1>
      </div>
      <p className="mb-5 text-lead text-paper-muted">
        选题来自三个入口：你的 FAQ、对标拆解、爆款复盘。FAQ 需在定位页点「生成选题」后才会出现在这里。
      </p>
      {!isLoading && isFreshMissing(pending, freshId) && (
        <p className="mb-3 text-meta text-paper-muted">
          刚生成的那条不在当前待拍列表里（可能已采用或已删除）。
        </p>
      )}

      {isLoading ? (
        <p className="text-copy text-paper-muted">加载中…</p>
      ) : pending.length === 0 ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-sub font-black text-paper-ink">选题库还是空的</p>
          <p className="mb-5 text-body leading-relaxed text-paper-muted">
            在定位页维护高频问答并点「生成选题」，或拆一个对标账号
            <br />
            爆款复盘产生的续集也会自动写入这里
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              to="/positioning"
              className="rounded-card bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover"
            >
              去维护 FAQ
            </Link>
            <Link
              to="/analyze"
              className="rounded-card border border-paper-primary px-6 py-3 text-body text-paper-primary hover:bg-paper-tint"
            >
              去拆一个对标账号
            </Link>
            <Link
              to="/kb"
              className="rounded-card border border-paper-lineStrong px-6 py-3 text-body text-paper-inkSoft hover:border-paper-primary"
            >
              先去知识库
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pending.map((t) => {
            const meta = topicSourceMeta(t.source);
            const { sourceLine, metrics } = parseTopicSrc(t);
            const faqOrigin = topicFaqOrigin(t);
            return (
              <div
                key={t.id}
                className={
                  isFreshTopic(t.id, freshId)
                    ? 'flex items-center gap-4 rounded-panel border border-paper-primary bg-paper-card px-5 py-4'
                    : 'flex items-center gap-4 rounded-panel border border-paper-line bg-paper-card px-5 py-4'
                }
              >
                <span
                  className={`shrink-0 whitespace-nowrap rounded-tag border px-2 py-[3px] text-hint font-bold ${meta.cls}`}
                >
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-[3px] line-clamp-2 text-lead font-medium text-paper-ink">
                    {t.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-paper-muted">
                    {/* 由 FAQ 生成的选题：显示生成时的问题快照（FAQ 后来改名也不动它）。
                        原 FAQ 已删除只做标注——稿子可能已经写了甚至发了，连选题一起删才是数据丢失。 */}
                    {faqOrigin ? (
                      <span className="min-w-0 truncate">
                        {faqOrigin.question ? `来自你的问答「${faqOrigin.question}」` : '来自你的高频问答'}
                        {faqOrigin.deleted && (
                          <span className="ml-1 text-paper-mutedLight">· 原问答已删除</span>
                        )}
                      </span>
                    ) : (
                      <span className="min-w-0 truncate">{sourceLine}</span>
                    )}
                    {metrics.map((m) => (
                      <span
                        key={m.label}
                        className="shrink-0 rounded-tag border border-paper-lineStrong bg-paper-sunken px-1.5 py-px text-hint text-paper-inkSoft"
                      >
                        {m.label} {m.value}
                      </span>
                    ))}
                  </div>
                </div>
                {t.benchmarkVideoId != null ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/analyze?video=${t.benchmarkVideoId}`)}
                    className="shrink-0 whitespace-nowrap rounded-chip border border-paper-lineStrong px-3.5 py-[7px] text-copy text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
                  >
                    看文案
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate(`/create?topic=${t.id}`)}
                  className="shrink-0 whitespace-nowrap rounded-chip border border-paper-primary px-4 py-[7px] text-copy text-paper-primary hover:bg-paper-tint"
                >
                  生成文案
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3.5 rounded-panel border border-dashed border-paper-goldSoft bg-paper-tint px-[18px] py-3.5 text-caption leading-normal text-paper-primary">
        选题只来自三处：定位页的「生成选题」、对标拆解存入、复盘爆款续集。没有每日热点。
      </p>
    </div>
  );
}
