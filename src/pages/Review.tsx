import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { validateLinkInput } from './analyze/helpers';
import {
  adoptScript,
  attributeScript,
  feedbackScript,
  getWeeklyReport,
  listScripts,
  trackScript,
  type AttributionView,
  type ScriptSummary,
  type TrackResponse,
  type WeeklyReportContent,
} from '../api/review';
import { formatMetric, isHistoryEmpty } from './reviewMode';

/**
 * C 端复盘页 {@code /review}（§4.4）——发布后复盘闭环：采用 → 登记链接 → 后端抓数据判态
 * → 归因 / 周卡。
 *
 * <p><b>复盘免费</b>（不扣额度）。无流式（硬不变量）——每端点一次返回 JSON。
 *
 * <p>三区：
 * <ol>
 *   <li><b>周归因卡</b>（留顶）：GET /review/weekly?week=本周一 → summary/wins/gaps/next_focus。
 *   <li><b>稿件表格</b>（9 列）：选题 / 平台 / 状态 / 播放 / 点赞 / 评论 / 分享 / 收藏 / 复盘动作。
 *   <li><b>行内动作</b>：draft→采用；pending→登记链接；tracking→改链重试；flop→看归因/反哺；
 *       rejected→反哺。爆款续集自动写入选题库（invalidate topics）。
 * </ol>
 *
 * <p>沿用纸感样式（paper palette + serif 标题 + 设计令牌），与 {@link Calibrate} / {@link Analyze} 一致。
 */
type StateGroup = 'draft' | 'pending' | 'tracking' | 'hot' | 'plain' | 'flop' | 'rejected';

const STATE_LABEL: Record<StateGroup, string> = {
  hot: '爆款',
  plain: '平平',
  flop: '扑街',
  tracking: '追踪中',
  pending: '待登记',
  draft: '草稿',
  rejected: '已废弃',
};

/** 令牌化徽章配色（裸 hex 已清，全部走 paper.*）。 */
const STATE_BADGE: Record<StateGroup, string> = {
  hot: 'border-paper-goldPale bg-paper-tint text-paper-primary',
  plain: 'border-paper-line bg-paper-tint text-paper-ink',
  flop: 'border-paper-dangerLine bg-paper-dangerTint text-paper-danger',
  tracking: 'border-paper-lineStrong bg-paper-card text-paper-primary',
  pending: 'border-paper-lineStrong bg-paper-card text-paper-primary',
  draft: 'border-paper-line bg-paper-card text-paper-muted',
  rejected: 'border-paper-line bg-paper-base text-paper-muted',
};

function isState(s: string | undefined): s is StateGroup {
  return !!s && STATE_LABEL.hasOwnProperty(s);
}

function StateBadge({ state }: { state: string }) {
  if (!isState(state)) return <span className="text-meta text-paper-mutedLight">—</span>;
  return (
    <span className={`rounded-badge border px-2.5 py-0.5 text-hint font-bold ${STATE_BADGE[state]}`}>
      {STATE_LABEL[state]}
    </span>
  );
}

/** 计算本周一（ISO 周首）的 YYYY-MM-DD——周归因 job 写的 week_start 约定。 */
function currentWeekStart(): string {
  const now = new Date();
  // JS getDay: 0=Sun..6=Sat；ISO 周一首：周一=1..周日=7，偏移 = (getDay+6)%7
  const offset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - offset);
  return monday.toISOString().slice(0, 10);
}

/** 9 列网格：选题 / 平台 / 状态 / 播放 / 点赞 / 评论 / 分享 / 收藏 / 动作。 */
const COLS = 'grid grid-cols-[1fr_72px_64px_52px_52px_52px_52px_52px_140px] gap-2 items-center';

export default function Review() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const errRef = useRef<HTMLDivElement>(null);
  const [banner, setBanner] = useState('');
  const [trackInputs, setTrackInputs] = useState<Record<number, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<number, string>>({});
  const [attributions, setAttributions] = useState<Record<number, AttributionView>>({});
  const weekStart = useMemo(currentWeekStart, []);

  const { data: scripts, isLoading } = useQuery<ScriptSummary[]>({
    queryKey: ['scripts'],
    queryFn: () => listScripts(),
  });

  const { data: weekly, isLoading: weeklyLoading } = useQuery<WeeklyReportContent | null>({
    queryKey: ['weeklyReport', weekStart],
    queryFn: () => getWeeklyReport(weekStart),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['scripts'] });
    qc.invalidateQueries({ queryKey: ['weeklyReport', weekStart] });
  };

  const adoptMut = useMutation({
    mutationFn: (id: number) => adoptScript(id),
    onSuccess: () => {
      setError(null);
      setBanner('已采用，待登记发布链接');
      refresh();
    },
    onError: (e: unknown) => setError(getBizMessage(e, '采用失败')),
  });

  const validateAndScroll = (raw: string): { url: string } | null => {
    const v = validateLinkInput(raw);
    if (!v.ok) {
      setError(v.message);
      errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    return { url: v.url };
  };

  const trackMut = useMutation({
    mutationFn: (vars: { id: number; url: string }) => trackScript(vars.id, vars.url),
    onSuccess: (r: TrackResponse, vars) => {
      setError(null);
      setTrackInputs((p) => ({ ...p, [vars.id]: '' }));
      setBanner(
        r.reviewState === 'hot'
          ? '判态完成：爆款——续集选题已写入选题库'
          : `判态完成：${r.reviewState}`,
      );
      if (r.reviewState === 'hot') {
        void qc.invalidateQueries({ queryKey: ['topics'] });
      }
      refresh();
    },
    onError: (e: unknown) => setError(getBizMessage(e, '抓取失败，可重试')),
  });

  const attrMut = useMutation({
    mutationFn: (id: number) => attributeScript(id),
    onSuccess: (r, id) => {
      setError(null);
      setAttributions((a) => ({ ...a, [id]: r }));
    },
    onError: (e: unknown) => setError(getBizMessage(e, '归因失败')),
  });

  const feedbackMut = useMutation({
    mutationFn: (vars: { id: number; reason: string }) => feedbackScript(vars.id, vars.reason),
    onSuccess: (_r, vars) => {
      setError(null);
      setBanner('反哺已提交');
      setFeedbackInputs((p) => ({ ...p, [vars.id]: '' }));
      void qc.invalidateQueries({ queryKey: ['topics'] });
      refresh();
    },
    onError: (e: unknown) => setError(getBizMessage(e, '反哺失败')),
  });

  return (
    <main className="mx-auto min-h-full max-w-[980px] px-5 py-8">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-title font-black text-paper-ink">发布复盘</h1>
          <p className="mt-1 text-lead text-paper-muted">
            登记发布链接 → 自动抓互动数据 → 判态 → 归因 / 周卡 · 复盘免费
          </p>
        </div>
        <Link
          to="/workbench"
          className="rounded-card border border-paper-lineStrong bg-paper-card px-3.5 py-2 text-copy font-bold text-paper-primary transition hover:bg-paper-tint"
        >
          返回工作台
        </Link>
      </header>

      {banner && (
        <p className="mb-4 rounded-card border border-paper-goldPale bg-paper-tint px-3 py-2 text-meta font-semibold text-paper-primary">
          {banner}
        </p>
      )}
      {error && (
        <div
          ref={errRef}
          role="alert"
          className="mb-4 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
        >
          {error}
        </div>
      )}

      {/* 周归因卡（留顶，令牌化） */}
      <section className="mb-6 rounded-block border border-paper-line bg-paper-card p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-sub font-bold text-paper-ink">本周归因</h2>
          <span className="text-hint text-paper-muted">week_start {weekStart}</span>
        </div>
        {weeklyLoading ? (
          <p className="text-copy text-paper-muted">加载中…</p>
        ) : !weekly ? (
          <p className="text-copy text-paper-muted">
            本周暂无归因报告（周日定时生成，或本周无已复盘稿件）。
          </p>
        ) : weekly.blocked ? (
          <p className="text-copy text-paper-danger">本周归因被安全拦截，下周自动重跑。</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div>
              <dt className="text-hint text-paper-muted">总览</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-body text-paper-ink">
                {weekly.summary || '（无摘要）'}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <ListBlock label="做对的" items={weekly.wins} tone="win" />
              <ListBlock label="待改进" items={weekly.gaps} tone="gap" />
            </div>
            <div>
              <dt className="text-hint text-paper-muted">下周聚焦</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-body text-paper-ink">
                {weekly.nextFocus || '（无建议）'}
              </dd>
            </div>
          </div>
        )}
      </section>

      {/* 稿件表格 */}
      {isLoading ? (
        <p className="py-10 text-center text-body text-paper-muted">加载中…</p>
      ) : isHistoryEmpty(scripts ?? []) ? (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black text-paper-ink">还没有稿件</p>
          <p className="mb-5 text-body leading-loose text-paper-inkSoft">
            生成并采用第一条文案后，它会出现在这里
            <br />
            发布后登记视频地址，数据回来自动判态
          </p>
          <Link
            to="/topics"
            className="rounded-panel bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover"
          >
            去选题库挑一个选题
          </Link>
        </div>
      ) : (
        <section className="overflow-hidden rounded-block border border-paper-line bg-paper-card">
          {/* 表头 */}
          <div
            className={`${COLS} border-b border-paper-line bg-paper-sunken px-5 py-3 text-meta font-bold text-paper-muted`}
          >
            <div>选题</div>
            <div>平台</div>
            <div>状态</div>
            <div>播放</div>
            <div>点赞</div>
            <div>评论</div>
            <div>分享</div>
            <div>收藏</div>
            <div>复盘动作</div>
          </div>
          {(scripts ?? []).map((s) => (
            <div key={s.id} className="border-b border-paper-tintDeep last:border-b-0">
              <div className={`${COLS} px-5 py-3.5`}>
                <div className="min-w-0">
                  <div className="truncate text-copy font-bold text-paper-ink">
                    {s.topicTitle || '选题已删除'}
                  </div>
                  <div className="text-hint text-paper-mutedLight">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-meta text-paper-inkSoft">{s.platform}</div>
                <div>
                  <StateBadge state={s.reviewState} />
                </div>
                <div className="text-meta text-paper-inkSoft">{formatMetric(s.playCount)}</div>
                <div className="text-meta text-paper-inkSoft">{formatMetric(s.likeCount)}</div>
                <div className="text-meta text-paper-inkSoft">{formatMetric(s.commentCount)}</div>
                <div className="text-meta text-paper-inkSoft">{formatMetric(s.shareCount)}</div>
                <div className="text-meta text-paper-inkSoft">{formatMetric(s.collectCount)}</div>
                <div className="text-meta">
                  {s.reviewState === 'draft' && (
                    <button
                      type="button"
                      onClick={() => adoptMut.mutate(s.id)}
                      disabled={adoptMut.isPending}
                      className="rounded-chip bg-paper-primary px-3 py-1 text-white hover:bg-paper-primaryHover disabled:opacity-45"
                    >
                      采用
                    </button>
                  )}
                  {s.reviewState === 'pending' && (
                    <div className="flex items-center gap-1">
                      <input
                        type="url"
                        placeholder="发布链接"
                        value={trackInputs[s.id] ?? ''}
                        onChange={(e) =>
                          setTrackInputs((p) => ({ ...p, [s.id]: e.target.value }))
                        }
                        className="w-24 rounded-chip border border-paper-lineStrong bg-paper-sunken px-2 py-1 text-meta outline-none focus:border-paper-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = validateAndScroll((trackInputs[s.id] ?? '').trim());
                          if (v) trackMut.mutate({ id: s.id, url: v.url });
                        }}
                        disabled={trackMut.isPending || !(trackInputs[s.id] ?? '').trim()}
                        className="rounded-chip bg-paper-primary px-2.5 py-1 text-white hover:bg-paper-primaryHover disabled:opacity-45"
                      >
                        {trackMut.isPending ? '抓取中…' : '登记'}
                      </button>
                    </div>
                  )}
                  {s.reviewState === 'tracking' && (
                    /* 失败可改链重试：tracking 行暴露 url input + 重试（再调 track） */
                    <div className="flex items-center gap-1">
                      <input
                        type="url"
                        placeholder="改链接重试"
                        value={trackInputs[s.id] ?? s.publishUrl ?? ''}
                        onChange={(e) =>
                          setTrackInputs((p) => ({ ...p, [s.id]: e.target.value }))
                        }
                        className="w-24 rounded-chip border border-paper-dangerLine bg-paper-dangerTint px-2 py-1 text-meta outline-none focus:border-paper-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const v = validateAndScroll((trackInputs[s.id] ?? s.publishUrl ?? '').trim());
                          if (v) trackMut.mutate({ id: s.id, url: v.url });
                        }}
                        disabled={trackMut.isPending || !(trackInputs[s.id] ?? s.publishUrl ?? '').trim()}
                        className="rounded-chip border border-paper-danger px-2.5 py-1 text-paper-danger hover:bg-paper-dangerTint disabled:opacity-45"
                      >
                        重试
                      </button>
                    </div>
                  )}
                  {(s.reviewState === 'hot' || s.reviewState === 'plain') && (
                    <span className="text-meta text-paper-mutedLight">数据正常</span>
                  )}
                  {s.reviewState === 'flop' && (
                    <button
                      type="button"
                      onClick={() => attrMut.mutate(s.id)}
                      disabled={attrMut.isPending}
                      className="rounded-chip border border-paper-lineStrong px-2.5 py-1 text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:opacity-45"
                    >
                      {attrMut.isPending ? '归因中…' : attributions[s.id] ? '刷新' : '看归因'}
                    </button>
                  )}
                  {(s.reviewState === 'flop' || s.reviewState === 'rejected') && (
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="反哺"
                        value={feedbackInputs[s.id] ?? ''}
                        onChange={(e) =>
                          setFeedbackInputs((p) => ({ ...p, [s.id]: e.target.value }))
                        }
                        className="w-20 rounded-chip border border-paper-lineStrong bg-paper-sunken px-2 py-1 text-meta outline-none focus:border-paper-primary"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          feedbackMut.mutate({
                            id: s.id,
                            reason: (feedbackInputs[s.id] ?? '').trim(),
                          })
                        }
                        disabled={feedbackMut.isPending || !(feedbackInputs[s.id] ?? '').trim()}
                        className="rounded-chip border border-paper-lineStrong px-2.5 py-1 text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:opacity-45"
                      >
                        反哺
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* flop 归因展开（全宽，令牌化） */}
              {s.reviewState === 'flop' && attributions[s.id] && (
                <div className="bg-paper-tint px-5 py-3">
                  <p className="text-copy text-paper-ink">
                    <span className="font-bold text-paper-muted">诊断：</span>
                    {attributions[s.id].diagnosis || '（无）'}
                  </p>
                  {attributions[s.id].suggestions.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-copy text-paper-ink">
                      {attributions[s.id].suggestions.map((sg, i) => (
                        <li key={i}>{sg}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

function ListBlock({
  label,
  items,
  tone,
}: {
  label: string;
  items?: string[];
  tone: 'win' | 'gap';
}) {
  const toneClass =
    tone === 'win'
      ? 'border-paper-goldPale bg-paper-tint text-paper-primary'
      : 'border-paper-dangerLine bg-paper-dangerTint text-paper-danger';
  return (
    <div>
      <dt className="text-hint text-paper-muted">{label}</dt>
      <dd className="mt-0.5">
        {!items || items.length === 0 ? (
          <span className="text-meta text-paper-muted">（无）</span>
        ) : (
          <ul className={`flex flex-col gap-1 rounded-card border px-2.5 py-1.5 ${toneClass}`}>
            {items.map((it, i) => (
              <li key={i} className="text-meta">
                {it}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}
