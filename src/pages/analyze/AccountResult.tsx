import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  parseAccountResult,
  parseStructure,
  type BenchmarkVideoView,
} from '../../api/analyze';
import { getBizMessage } from '../../api/client';
import { getActiveProfile } from '../../api/profile';
import { createTopic } from '../../api/topic';
import {
  fmtCount,
  fmtDuration,
  parsePatternBars,
  profileField,
  splitMigrationAdvice,
  splitProfileSentences,
} from './helpers';

const PREVIEW_COUNT = 5;

/**
 * 拆账号结果四块：①画像对比 ②TOP 表 ③规律 ④迁移。
 * 深拆 = 只读展开该条 structure；仿写 = createTopic → `/create?topic=`。
 * TOP 视频选题由后端 getTask/poller 自动入库，④ 区引导去选题库即可。
 */
export default function AccountResult({
  resultJson,
  videos,
}: {
  resultJson: string | null;
  videos: BenchmarkVideoView[];
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const summary = parseAccountResult(resultJson);
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getActiveProfile,
    staleTime: 30_000,
  });

  const [expandedAll, setExpandedAll] = useState(false);
  const [deepId, setDeepId] = useState<number | null>(null);

  // 后端已在轮询 getTask 时 sync benchmark 选题——刷新列表缓存
  useEffect(() => {
    if (videos.length > 0) {
      void queryClient.invalidateQueries({ queryKey: ['topics'] });
    }
  }, [videos.length, queryClient]);

  const visible = expandedAll ? videos : videos.slice(0, PREVIEW_COUNT);

  const youLabel = useMemo(() => {
    const c = profile?.content ?? {};
    const name = profileField(c, ['称呼', '昵称', '名字', '账号名', '人设称呼']);
    const niche = profileField(c, ['赛道', '品类', '行业', '定位']);
    if (name && niche) return `你（${name}·${niche}）`;
    if (name) return `你（${name}）`;
    if (profile?.calibrated) return '你（已校准档案）';
    return '你（未校准）';
  }, [profile]);

  const peerSentences = splitProfileSentences(summary?.account_profile ?? '', 3);
  const youRows = [
    profileField(profile?.content ?? {}, ['人设', '角色', '身份']),
    profileField(profile?.content ?? {}, ['变现', '变现路径', '商业模式']),
    profileField(profile?.content ?? {}, ['频率', '更新频率', '发布节奏']),
  ];
  // 对标列：有分句用分句，否则首格放整段画像摘要
  const peerRows =
    peerSentences.length > 0
      ? [peerSentences[0] ?? '', peerSentences[1] ?? '', peerSentences[2] ?? '']
      : [summary?.account_profile?.trim() ?? '', '', ''];

  const borrowHint = useMemo(() => {
    const advice = summary?.migration_advice?.trim() ?? '';
    if (!advice) return '';
    const first = advice.split(/(?<=[。！？\n])/)[0]?.trim() ?? advice;
    return first.slice(0, 200);
  }, [summary]);

  const bars = parsePatternBars(summary?.patterns ?? '');
  const migration = splitMigrationAdvice(summary?.migration_advice ?? '');

  const imitateMut = useMutation({
    mutationFn: async (v: BenchmarkVideoView) => {
      const title = (v.title || '对标仿写').trim().slice(0, 80);
      const struct = parseStructure(v.structure);
      const rationale = [
        struct?.framework,
        struct?.diff_hint,
        v.transcript ? `原文摘录：${v.transcript.slice(0, 200)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
        .slice(0, 500);
      return createTopic(title, rationale, 'benchmark');
    },
    onSuccess: (id) => navigate(`/create?topic=${id}`),
  });

  if (!summary && videos.length === 0) {
    return (
      <p className="text-copy text-paper-muted">归纳结果暂未生成（部分失败时可能只有明细）。</p>
    );
  }

  return (
    <div className="flex animate-slideup flex-col gap-4">
      {/* ① 画像对比 */}
      <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
        <h3 className="mb-3.5 text-copy font-bold text-paper-ink">① 账号画像 · 与你的定位对比</h3>
        <div className="grid grid-cols-[84px_1fr_1fr] gap-x-3.5 gap-y-2.5 text-caption">
          <div />
          <div className="font-bold text-paper-info">对标账号</div>
          <div className="font-bold text-paper-primary">{youLabel}</div>
          {(['人设', '变现', '频率'] as const).map((label, i) => (
            <FragmentRow
              key={label}
              label={label}
              peer={peerRows[i] || '—'}
              you={youRows[i] || (profile?.calibrated ? '—' : '去校准档案补全')}
            />
          ))}
        </div>
        {borrowHint ? (
          <div className="mt-3 rounded-chip border-l-[3px] border-paper-primary bg-paper-tint px-3.5 py-2.5 text-caption leading-normal text-paper-ink">
            <strong>可借鉴：</strong>
            {borrowHint}
          </div>
        ) : null}
        {summary?.account_profile && peerSentences.length > 0 ? (
          <p className="mt-3 whitespace-pre-wrap break-words text-caption leading-normal text-paper-inkSoft">
            {summary.account_profile}
          </p>
        ) : null}
      </section>

      {/* ② TOP 清单 */}
      {videos.length > 0 ? (
        <section className="overflow-hidden rounded-block border border-paper-line bg-paper-card">
          <div className="flex items-baseline justify-between px-6 pb-3 pt-[18px]">
            <h3 className="text-copy font-bold text-paper-ink">
              ② 播放 TOP{videos.length} 视频清单{' '}
              <span className="text-hint font-normal text-paper-muted">
                文案与结构已全部留存，展示前 {Math.min(PREVIEW_COUNT, videos.length)} 条
              </span>
            </h3>
            {videos.length > PREVIEW_COUNT ? (
              <button
                type="button"
                onClick={() => setExpandedAll((x) => !x)}
                className="text-meta text-paper-primary hover:text-paper-primaryHover"
              >
                {expandedAll ? '收起' : `展开全部 ${videos.length} 条`}
              </button>
            ) : null}
          </div>

          <div className="hidden grid-cols-[28px_minmax(0,1.4fr)_repeat(5,52px)_minmax(100px,1fr)_130px] gap-2 border-b border-paper-line bg-paper-sunken px-6 py-2 text-hint font-bold text-paper-muted lg:grid">
            <div>#</div>
            <div>标题</div>
            <div>播放</div>
            <div>点赞</div>
            <div>评论</div>
            <div>分享</div>
            <div>收藏</div>
            <div>结构</div>
            <div />
          </div>

          <ul>
            {visible.map((v, idx) => {
              const struct = parseStructure(v.structure);
              const structBrief =
                struct?.structure?.slice(0, 36) ||
                struct?.framework?.slice(0, 36) ||
                '—';
              const open = deepId === v.id;
              const rank = idx + 1;
              const collect = v.collectCount ?? v.favCount;
              const tagList = parseTags(v.tags);
              return (
                <li key={v.id} className="border-b border-paper-tintDeep">
                  <div className="grid grid-cols-1 items-center gap-2 px-6 py-3 text-caption lg:grid-cols-[28px_minmax(0,1.4fr)_repeat(5,52px)_minmax(100px,1fr)_130px]">
                    <div className="font-bold text-paper-mutedLight">{rank}</div>
                    <div className="min-w-0 text-copy leading-snug text-paper-ink">
                      <div className="line-clamp-2">{v.title || '（无标题）'}</div>
                      <div className="mt-0.5 text-hint text-paper-mutedLight">
                        {[
                          v.publishedAt ? formatPub(v.publishedAt) : null,
                          fmtDuration(v.durationSec) || null,
                          !v.publishedAt && !v.durationSec
                            ? v.transcript
                              ? '文案全文已留存'
                              : '暂无文案'
                            : null,
                          tagList.length > 0
                            ? tagList.slice(0, 3).map((t) => `#${t}`).join(' ')
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className="text-paper-inkSoft">{fmtCount(v.playCount)}</div>
                    <div className="text-paper-inkSoft">{fmtCount(v.likeCount ?? null)}</div>
                    <div className="text-paper-inkSoft">{fmtCount(v.commentCount ?? null)}</div>
                    <div className="text-paper-inkSoft">{fmtCount(v.shareCount ?? null)}</div>
                    <div className="text-paper-inkSoft">{fmtCount(collect)}</div>
                    <div className="line-clamp-2 text-paper-muted">{structBrief}</div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDeepId(open ? null : v.id)}
                        className="whitespace-nowrap rounded-chip border border-paper-lineStrong px-2.5 py-1 text-meta text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary"
                      >
                        {open ? '收起' : '深拆'}
                      </button>
                      <button
                        type="button"
                        disabled={imitateMut.isPending}
                        onClick={() => imitateMut.mutate(v)}
                        className="whitespace-nowrap rounded-chip border border-paper-primary px-2.5 py-1 text-meta text-paper-primary hover:bg-paper-tint disabled:opacity-45"
                      >
                        仿写
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <div className="space-y-3 bg-paper-sunken px-6 pb-4">
                      {v.description ? (
                        <p className="whitespace-pre-wrap break-words text-caption leading-normal text-paper-inkSoft">
                          <span className="font-bold text-paper-muted">描述 · </span>
                          {v.description}
                        </p>
                      ) : null}
                      {v.transcript ? (
                        <p className="whitespace-pre-wrap break-words rounded-card bg-paper-tint px-3 py-2 text-caption leading-normal text-paper-ink">
                          {v.transcript}
                        </p>
                      ) : null}
                      {struct ? (
                        <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <MiniField label="文案结构" value={struct.structure ?? ''} />
                          <MiniField label="爆火原因" value={struct.why_hot ?? ''} />
                          <MiniField label="可复用框架" value={struct.framework ?? ''} />
                          <MiniField label="差异化提示" value={struct.diff_hint ?? ''} />
                        </dl>
                      ) : (
                        <p className="text-caption text-paper-muted">该条暂无结构化拆解。</p>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {imitateMut.isError ? (
            <p className="px-6 py-2 text-meta text-paper-danger">
              {getBizMessage(imitateMut.error, '创建选题失败')}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ③④ */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
          <h3 className="mb-3 text-copy font-bold text-paper-ink">③ TOP10 爆款规律</h3>
          {bars.length > 0 ? (
            <div className="flex flex-col gap-2.5 text-caption">
              {bars.map((b, i) => (
                <div
                  key={b.label}
                  className="grid grid-cols-[96px_1fr_34px] items-center gap-2.5"
                >
                  <span className="truncate text-paper-ink">{b.label}</span>
                  <div className="h-2 rounded-tag bg-paper-shade">
                    <div
                      className={`h-2 rounded-tag ${barColor(i)}`}
                      style={{ width: `${b.pct}%` }}
                    />
                  </div>
                  <span className="text-hint text-paper-muted">{b.count}条</span>
                </div>
              ))}
            </div>
          ) : null}
          {summary?.patterns ? (
            <p
              className={`whitespace-pre-wrap break-words text-caption leading-relaxed text-paper-inkSoft ${
                bars.length > 0 ? 'mt-3 border-t border-paper-tintDeep pt-3' : ''
              }`}
            >
              {summary.patterns}
            </p>
          ) : (
            <p className="text-caption text-paper-muted">暂无规律归纳。</p>
          )}
        </section>

        <section className="flex flex-col rounded-block border border-paper-line bg-paper-card px-6 py-5">
          <h3 className="mb-3 text-copy font-bold text-paper-ink">④ 迁移到你的账号</h3>
          <div className="flex flex-1 flex-col gap-2 text-caption leading-normal">
            {migration.length > 0 ? (
              migration.map((m, i) => (
                <div key={i} className={`rounded-chip px-3 py-2 ${migClass(m.kind)}`}>
                  {m.text}
                </div>
              ))
            ) : (
              <p className="text-paper-muted">暂无迁移建议。</p>
            )}
          </div>
          <p className="mt-2 text-meta text-paper-muted">
            {videos.length > 0
              ? 'TOP 视频选题已自动写入选题库（幂等，可重复查看）。'
              : '暂无视频可写入选题。'}
          </p>
          <button
            type="button"
            disabled={videos.length === 0}
            onClick={() => navigate('/topics')}
            className="mt-3.5 rounded-card bg-paper-primary px-3 py-3 text-body font-medium text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
          >
            去选题库查看
          </button>
        </section>
      </div>
    </div>
  );
}

function FragmentRow({
  label,
  peer,
  you,
}: {
  label: string;
  peer: string;
  you: string;
}) {
  return (
    <>
      <div className="text-paper-muted">{label}</div>
      <div className="leading-normal text-paper-ink">{peer}</div>
      <div className="leading-normal text-paper-ink">{you}</div>
    </>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-paper-line bg-paper-card px-3.5 py-3">
      <dt className="mb-1 text-hint font-bold text-paper-muted">{label}</dt>
      <dd className="whitespace-pre-wrap break-words text-copy leading-normal text-paper-ink">
        {value || <span className="text-paper-muted">—</span>}
      </dd>
    </div>
  );
}

function barColor(i: number): string {
  if (i === 0) return 'bg-paper-primary';
  if (i === 1) return 'bg-paper-gold';
  return 'bg-paper-info';
}

function migClass(kind: 'good' | 'opportunity' | 'avoid' | 'plain'): string {
  switch (kind) {
    case 'good':
    case 'opportunity':
      return 'bg-paper-successTint text-paper-ink';
    case 'avoid':
      return 'bg-paper-dangerTint text-paper-ink';
    default:
      return 'bg-paper-sunken text-paper-ink';
  }
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  } catch {
    /* ignore */
  }
  return [];
}

function formatPub(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '已留存';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `发布 ${y}-${m}-${day}`;
}
