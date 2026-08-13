import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../../api/client';
import { createTopic } from '../../api/topic';
import { structureTimeline } from './helpers';

/**
 * 拆视频结果：左栏结构时间轴 + 框架/差异；右栏爆点 / 知识库提示 / 仿写入口。
 * 对齐原型 `sections/14-对标拆解.html` 拆视频完成态（无假演示数据）。
 */
export default function VideoResult({
  structure,
  whyHot,
  framework,
  diffHint,
  imitateTitle,
}: {
  structure: string;
  whyHot: string;
  framework: string;
  diffHint: string;
  /** 仿写：建选题后跳 `/create?topic=`；缺省用框架首句 */
  imitateTitle?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [savedTopicId, setSavedTopicId] = useState<number | null>(null);
  const steps = structureTimeline(structure);
  const whyLines = whyHot
    .split(/\n+|(?<=[。；])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);

  /** 列表标题：取框架/预填首句，避免整段 framework 塞进选题库。 */
  const topicTitle = () => {
    const raw = (imitateTitle || framework || '对标拆解选题').trim();
    const first = raw.split(/[→\n。！？]/)[0]?.trim() || raw;
    return (first || '对标拆解选题').slice(0, 80);
  };

  const imitateMut = useMutation({
    mutationFn: async () => {
      // 仿写带完整上下文，创作页可感知框架/差异
      const rationale = [framework, whyHot, diffHint]
        .filter(Boolean)
        .join('\n')
        .slice(0, 500);
      return createTopic(topicTitle(), rationale, 'benchmark');
    },
    onSuccess: (id) => {
      void queryClient.invalidateQueries({ queryKey: ['topics'] });
      navigate(`/create?topic=${id}`);
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      // 选题库副行对齐原型短 `t.src`，不写墙文
      return createTopic(topicTitle(), '对标拆解 · 拆视频存入', 'benchmark');
    },
    onSuccess: (id) => {
      setSavedTopicId(id);
      void queryClient.invalidateQueries({ queryKey: ['topics'] });
    },
  });

  return (
    <div className="grid animate-slideup grid-cols-1 gap-[18px] lg:grid-cols-[1fr_300px]">
      <div className="flex flex-col gap-3.5">
        <div className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
          <h3 className="mb-3.5 text-copy font-bold text-paper-ink">结构拆解</h3>
          <div className="flex flex-col gap-2.5 text-body">
            {steps.map((s, i) => (
              <div key={i} className="grid grid-cols-[96px_1fr] items-start gap-3">
                <span
                  className={`rounded-tag py-0.5 text-center text-hint font-bold ${toneClass(s.tone)}`}
                >
                  {s.label}
                </span>
                <p className="whitespace-pre-wrap break-words leading-normal text-paper-ink">{s.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
          <h3 className="mb-3 text-copy font-bold text-paper-ink">可复用框架</h3>
          <p className="mb-3 whitespace-pre-wrap break-words rounded-card border border-paper-tintDeep bg-paper-sunken px-4 py-3.5 text-body leading-relaxed text-paper-ink">
            {framework || '—'}
          </p>
          {diffHint ? (
            <p className="whitespace-pre-wrap break-words text-caption leading-normal text-paper-muted">
              ⚠ 差异提醒：{diffHint}
            </p>
          ) : null}
        </div>
      </div>

      <aside className="flex flex-col gap-3">
        <div className="rounded-panel border border-paper-line bg-paper-card px-[18px] py-4">
          <div className="mb-1.5 text-hint font-bold text-paper-primary">爆点归因</div>
          <div className="flex flex-col gap-2 text-caption leading-normal text-paper-inkSoft">
            {whyLines.length > 0 ? (
              whyLines.map((line, i) => (
                <div key={i} className="text-paper-ink">
                  {line}
                </div>
              ))
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        <div className="rounded-panel border border-paper-line bg-paper-card px-[18px] py-4">
          <div className="mb-1.5 text-hint font-bold text-paper-primary">与你知识库的连接</div>
          <p className="text-caption leading-normal text-paper-inkSoft">
            仿写时会按当前定位档案检索知识库引用；可先完善档案与 B 层案例卡。
          </p>
        </div>

        <button
          type="button"
          disabled={imitateMut.isPending}
          onClick={() => imitateMut.mutate()}
          className="rounded-card bg-paper-primary px-5 py-3 text-center text-lead font-medium text-white transition hover:bg-paper-primaryHover disabled:opacity-45"
        >
          {imitateMut.isPending ? '准备中…' : '用这个框架仿写 →'}
        </button>
        {imitateMut.isError ? (
          <p className="text-meta text-paper-danger">
            {getBizMessage(imitateMut.error, '创建选题失败')}
          </p>
        ) : null}
        <button
          type="button"
          disabled={saveMut.isPending || savedTopicId != null}
          onClick={() => saveMut.mutate()}
          className={`rounded-card border px-5 py-[11px] text-center text-body transition ${
            savedTopicId != null
              ? 'border-paper-success bg-paper-successTint text-paper-successDeep'
              : 'border-paper-lineStrong bg-transparent text-paper-ink hover:border-paper-primary hover:text-paper-primary'
          } disabled:cursor-not-allowed`}
        >
          {saveMut.isPending
            ? '存入中…'
            : savedTopicId != null
              ? '已存入选题库'
              : '存入选题库'}
        </button>
        {saveMut.isError ? (
          <p className="text-meta text-paper-danger">
            {getBizMessage(saveMut.error, '存入选题失败')}
          </p>
        ) : null}
        {savedTopicId != null ? (
          <button
            type="button"
            onClick={() => navigate('/topics')}
            className="text-meta text-paper-primary hover:underline"
          >
            去选题库查看 →
          </button>
        ) : null}
      </aside>
    </div>
  );
}

function toneClass(tone: 'hook' | 'body' | 'cta' | 'plain'): string {
  switch (tone) {
    case 'hook':
      return 'border border-paper-dangerLine bg-paper-dangerTint text-paper-danger';
    case 'cta':
      return 'border border-paper-goldPale bg-paper-tint text-paper-info';
    case 'body':
      return 'border border-paper-goldPale bg-paper-tint text-paper-primary';
    default:
      return 'border border-paper-line bg-paper-sunken text-paper-muted';
  }
}
