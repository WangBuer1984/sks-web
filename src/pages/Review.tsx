import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import { PLATFORM_LABELS, PLATFORMS, registerPublication, type Platform } from '../api/content';
import {
  attributePublication,
  generateWeekly,
  getReviewBoard,
  getWeekly,
  reviewPublication,
  type AttributionView,
  type ReviewBoardView,
} from '../api/publication';
import { attemptRegister } from './analyze/helpers';
import {
  PUBLICATION_STATE_LABELS,
  countReviewable,
  formatMetric,
  hasMetrics,
  isBoardEmpty,
  isoWeekStart,
  normalizeWeekly,
} from './reviewMode';

const COLS = 'grid grid-cols-[1fr_72px_64px_52px_52px_52px_52px_52px_120px] gap-2 items-center';

export default function Review() {
  const qc = useQueryClient();
  const weekStart = useMemo(() => isoWeekStart(), []);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState('');
  const [regFor, setRegFor] = useState<number | null>(null);
  const [regPlatform, setRegPlatform] = useState<Platform>('douyin');
  const [regUrl, setRegUrl] = useState('');
  const [regConfirmMismatch, setRegConfirmMismatch] = useState(false);
  const [attrs, setAttrs] = useState<Record<number, AttributionView>>({});

  const { data: board, isLoading } = useQuery<ReviewBoardView>({
    queryKey: ['review', 'board'],
    queryFn: () => getReviewBoard(),
  });

  const { data: weeklyRaw } = useQuery({
    queryKey: ['weeklyReport', weekStart],
    queryFn: () => getWeekly(weekStart),
  });
  const weekly = normalizeWeekly(weeklyRaw);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['review'] });
    void qc.invalidateQueries({ queryKey: ['contents'] });
    void qc.invalidateQueries({ queryKey: ['topics'] });
    void qc.invalidateQueries({ queryKey: ['weeklyReport', weekStart] });
  };

  const reviewMut = useMutation({
    mutationFn: (id: number) => reviewPublication(id),
    onSuccess: (p) => {
      setError(null);
      setBanner(p.state === 'hot' ? '复盘完成：爆款——续集选题已写入选题库（不会重复创建）' : `复盘完成：${PUBLICATION_STATE_LABELS[p.state]}`);
      refresh();
    },
    onError: (e: unknown) => setError(getBizMessage(e, '复盘失败，可重试')),
  });

  const attrMut = useMutation({
    mutationFn: (id: number) => attributePublication(id),
    onSuccess: (r, id) => {
      setAttrs((p) => ({ ...p, [id]: r }));
      setError(null);
    },
    onError: (e: unknown) => setError(getBizMessage(e, '归因失败')),
  });

  const weeklyMut = useMutation({
    mutationFn: () => generateWeekly(weekStart),
    onSuccess: () => {
      setBanner('本周复盘已生成');
      void qc.invalidateQueries({ queryKey: ['weeklyReport', weekStart] });
    },
    onError: (e: unknown) => setError(getBizMessage(e, '生成本周复盘失败')),
  });

  const tryRegister = () => {
    const v = attemptRegister(regUrl, regPlatform, regConfirmMismatch);
    if (!v.ok) {
      setError(v.message);
      return;
    }
    if (v.needsConfirm) {
      setRegConfirmMismatch(true);
      setError(v.message);
      return;
    }
    setError(null);
    regMut.mutate(v.url);
  };

  const regMut = useMutation({
    mutationFn: (url: string) => registerPublication(regFor!, regPlatform, url),
    onSuccess: () => {
      setRegFor(null);
      setRegUrl('');
      setRegConfirmMismatch(false);
      setBanner('已登记，五码仍为空。点「复盘」才会抓数。');
      refresh();
    },
    onError: (e: unknown) => setError(getBizMessage(e, '登记失败')),
  });

  const empty = !board || isBoardEmpty(board);
  const canWeekly = board ? countReviewable(board) > 0 : false;

  return (
    <div className="mx-auto max-w-[960px]">
      <h1 className="mb-1 font-serif text-title font-black text-paper-ink">发布复盘</h1>
      <p className="mb-5 text-lead text-paper-muted">
        登记只存链接；点「复盘」才抓五码。同一内容可在同一平台登记多个链接，各自复盘。
      </p>
      {error && <p className="mb-3 text-copy text-paper-danger">{error}</p>}
      {banner && <p className="mb-3 text-copy text-paper-success">{banner}</p>}

      <section className="mb-6 rounded-block border border-paper-line bg-paper-card px-5 py-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-serif text-sub font-black">本周复盘</h2>
          <button
            type="button"
            disabled={!canWeekly || weeklyMut.isPending}
            onClick={() => weeklyMut.mutate()}
            className="text-meta text-paper-primary disabled:opacity-45"
          >
            {weeklyMut.isPending ? '生成中…' : '生成本周复盘'}
          </button>
        </div>
        {!weekly ? (
          <p className="text-copy text-paper-muted">还没有本周报告。有已复盘记录后再点生成。</p>
        ) : weekly.blocked ? (
          <p className="text-copy text-paper-danger">本周归因被安全拦截。</p>
        ) : (
          <div className="text-copy text-paper-inkSoft">
            <p className="mb-2">{weekly.summary ?? '（无摘要）'}</p>
            {weekly.wins.length > 0 && <p>做得好：{weekly.wins.join('；')}</p>}
            {weekly.gaps.length > 0 && <p>缺口：{weekly.gaps.join('；')}</p>}
            <p>下周聚焦：{weekly.nextFocus ?? '（无建议）'}</p>
          </div>
        )}
      </section>

      {isLoading && <p className="text-copy text-paper-muted">加载中…</p>}
      {empty && !isLoading && (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-sub font-black">还没有待发布或已登记的内容</p>
          <p className="mb-5 text-body text-paper-muted">在创作页采用某个平台版本，或在知识库手建内容后登记发布。</p>
          <Link to="/kb" className="rounded-card bg-paper-primary px-6 py-3 text-body text-white">
            去知识库
          </Link>
        </div>
      )}

      {board && board.pending.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-copy font-bold">待发布</h2>
          <div className="flex flex-col gap-2">
            {board.pending.map((c) => (
              <div
                key={c.contentId}
                className="flex items-center justify-between rounded-panel border border-paper-line bg-paper-card px-4 py-3"
              >
                <div>
                  <div className="text-lead text-paper-ink">{c.title}</div>
                  <div className="text-meta text-paper-muted">
                    {c.source === 'manual' ? '我传的' : '平台生成'}
                    {c.platform ? ` · ${PLATFORM_LABELS[c.platform as Platform] ?? c.platform}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRegFor(c.contentId);
                    setRegPlatform((c.platform as Platform) || 'douyin');
                    setRegUrl('');
                    setRegConfirmMismatch(false);
                  }}
                  className="rounded-chip border border-paper-primary px-3 py-1 text-copy text-paper-primary"
                >
                  登记发布
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {board && board.publications.length > 0 && (
        <section>
          <div className={`${COLS} mb-2 text-hint font-bold text-paper-muted`}>
            <span>内容 / 链接</span>
            <span>平台</span>
            <span>状态</span>
            <span>播放</span>
            <span>点赞</span>
            <span>评论</span>
            <span>分享</span>
            <span>收藏</span>
            <span>动作</span>
          </div>
          {board.publications.map((p) => (
            <div key={p.id} className="mb-2 rounded-panel border border-paper-line bg-paper-card px-3 py-2">
              <div className={`${COLS} text-copy`}>
                <span className="truncate text-paper-ink">{p.publishUrl}</span>
                <span>{PLATFORM_LABELS[p.platform]}</span>
                <span>{PUBLICATION_STATE_LABELS[p.state]}</span>
                <span>{hasMetrics(p) ? formatMetric(p.playCount) : '—'}</span>
                <span>{hasMetrics(p) ? formatMetric(p.likeCount) : '—'}</span>
                <span>{hasMetrics(p) ? formatMetric(p.commentCount) : '—'}</span>
                <span>{hasMetrics(p) ? formatMetric(p.shareCount) : '—'}</span>
                <span>{hasMetrics(p) ? formatMetric(p.collectCount) : '—'}</span>
                <span className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => reviewMut.mutate(p.id)}
                    className="text-left text-meta text-paper-primary"
                  >
                    {hasMetrics(p) ? '再次复盘' : '复盘'}
                  </button>
                  {p.state === 'flop' && (
                    <button
                      type="button"
                      onClick={() => attrMut.mutate(p.id)}
                      className="text-left text-meta text-paper-inkSoft"
                    >
                      看归因
                    </button>
                  )}
                </span>
              </div>
              {attrs[p.id] && (
                <p className="mt-2 text-caption text-paper-inkSoft">
                  {attrs[p.id].diagnosis}
                  {attrs[p.id].suggestions?.length ? ` · ${attrs[p.id].suggestions.join('；')}` : ''}
                  <span className="mt-1 block text-paper-muted">
                    这些建议不会自动写入档案。
                    {attrs[p.id].voiceSuggestSaved && (
                      <Link to="/positioning" className="ml-1 text-paper-primary hover:text-paper-primaryHover">
                        去定位页确认
                      </Link>
                    )}
                  </span>
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      {regFor != null && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[440px] rounded-block bg-paper-card p-6">
            <h2 className="mb-2 font-serif text-sub font-black">登记发布</h2>
            <div className="mb-2 flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setRegPlatform(p);
                    setRegConfirmMismatch(false);
                  }}
                  className={
                    regPlatform === p
                      ? 'rounded-badge border border-paper-primary px-3 py-1 text-paper-primary'
                      : 'rounded-badge border px-3 py-1'
                  }
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
            <textarea
              value={regUrl}
              onChange={(e) => {
                setRegUrl(e.target.value);
                setRegConfirmMismatch(false);
              }}
              rows={3}
              placeholder="粘贴抖音或视频号分享文案"
              className="mb-3 w-full rounded-card border px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={tryRegister}
                className="rounded-card bg-paper-primary px-5 py-2 text-white"
              >
                登记
              </button>
              <button type="button" onClick={() => setRegFor(null)} className="rounded-card border px-5 py-2">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
