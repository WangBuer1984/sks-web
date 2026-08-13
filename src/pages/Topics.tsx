import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { listTopics, refreshHotTopics, type Topic } from '../api/topic';
import { topicSourceMeta } from '../lib/topicSourceMeta';

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
  const queryClient = useQueryClient();
  const [hotMsg, setHotMsg] = useState<string | null>(null);
  const { data: topics, isLoading } = useQuery<Topic[]>({
    queryKey: ['topics'],
    queryFn: () => listTopics(),
  });

  const hotMut = useMutation({
    mutationFn: () => refreshHotTopics(),
    onSuccess: (n) => {
      void queryClient.invalidateQueries({ queryKey: ['topics'] });
      setHotMsg(
        n > 0
          ? `已写入 ${n} 条热点选题`
          : '未匹配到新热点（需知识库 B 层案例卡，或热点已入库）',
      );
    },
    onError: (e: unknown) => setHotMsg(getBizMessage(e, '拉取热点失败')),
  });

  const pending = (topics ?? []).filter((t) => t.status === 'open');

  return (
    <div className="mx-auto max-w-[880px]">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="font-serif text-title font-black text-paper-ink">
          选题库{' '}
          <span className="font-sans text-copy font-normal text-paper-muted">
            {isLoading ? '加载中…' : `${pending.length} 个待拍选题`}
          </span>
        </h1>
        <button
          type="button"
          disabled={hotMut.isPending}
          onClick={() => {
            setHotMsg(null);
            hotMut.mutate();
          }}
          className="shrink-0 text-meta text-paper-primary hover:text-paper-primaryHover disabled:opacity-45"
        >
          {hotMut.isPending ? '拉取中…' : '拉取今日热点'}
        </button>
      </div>
      <p className="mb-5 text-lead text-paper-muted">
        选题来自四个入口：每日热点、你的 FAQ、对标拆解、爆款复盘——都对齐你的内容支柱配比
      </p>
      {hotMsg ? <p className="mb-3 text-meta text-paper-muted">{hotMsg}</p> : null}

      {isLoading ? (
        <p className="text-copy text-paper-muted">加载中…</p>
      ) : pending.length === 0 ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-sub font-black text-paper-ink">选题库还是空的</p>
          <p className="mb-5 text-body leading-relaxed text-paper-muted">
            完成账号定位校准并补充知识库案例卡后，可拉取热点选题
            <br />
            也可以现在拆一个对标账号，拆完 TOP 视频会自动写入这里
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              disabled={hotMut.isPending}
              onClick={() => {
                setHotMsg(null);
                hotMut.mutate();
              }}
              className="rounded-card bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover disabled:opacity-45"
            >
              {hotMut.isPending ? '拉取中…' : '拉取今日热点'}
            </button>
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
              先补知识库
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {pending.map((t) => {
            const meta = topicSourceMeta(t.source);
            const { sourceLine, metrics } = parseTopicSrc(t);
            return (
              <div
                key={t.id}
                className="flex items-center gap-4 rounded-panel border border-paper-line bg-paper-card px-5 py-4"
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
                    <span className="min-w-0 truncate">{sourceLine}</span>
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
        拆账号完成后 TOP 视频会自动汇入（标题 + 播放/收藏）；拆视频可点「存入选题库」；发布复盘续集也会写入这里。
      </p>
    </div>
  );
}
