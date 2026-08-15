import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../../api/client';
import { createTopic } from '../../api/topic';
import { structureTimeline } from './helpers';
import TranscriptBlock from './TranscriptBlock';

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
  transcript,
  existingTopicId,
}: {
  structure: string;
  whyHot: string;
  framework: string;
  diffHint: string;
  /** 仿写：建选题后跳 `/create?topic=`；缺省用框架首句 */
  imitateTitle?: string;
  /** 转写全文：链接流读 result.transcript，粘文案流用用户输入原文；无则不渲染该区块。 */
  transcript?: string | null;
  /**
   * 已关联的选题 id（详情态从 `BenchmarkVideoDetail.topicId` 传入）。
   * 非空 → 「存入选题库」直接是已存入终态：该条随拆账号早已汇入选题库，再存会建一条
   * 标题对不上的重复选题（spec D11）。
   */
  existingTopicId?: number | null;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [savedTopicId, setSavedTopicId] = useState<number | null>(existingTopicId ?? null);
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

  /** 仿写：带完整上下文（框架/爆点/差异）跳 `/create`，**预填框架到输入框、不自动生成**。
   *
   * 用户在创作页编辑后点「生成口播稿」时，Create 页用编辑后文字建选题（title），
   * 把这里的 rationale（framework+whyHot+diffHint）喂大模型——保留 benchmark 上下文。
   * 不在此 createTopic：避免落地即建孤儿选题；选题由用户真正点生成时才建。
   * （「存入选题库」是另一个按钮 saveMut，独立于此。） */
  const imitate = () => {
    const presetTopic = (framework || imitateTitle || '').trim();
    const rationale = [framework, whyHot, diffHint].filter(Boolean).join('\n').slice(0, 500);
    navigate('/create', {
      state: { presetTopic, presetRationale: rationale, presetSource: 'benchmark' },
    });
  };

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
    <div className="flex animate-slideup flex-col gap-4">
      <div className="grid grid-cols-1 items-start gap-[18px] lg:grid-cols-[1fr_300px]">
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

      <aside className="flex flex-col gap-3 lg:sticky lg:top-2">
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
          onClick={imitate}
          className="rounded-card bg-paper-primary px-5 py-3 text-center text-lead font-medium text-white transition hover:bg-paper-primaryHover"
        >
          用这个框架仿写 →
        </button>
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

      {transcript?.trim() ? <TranscriptBlock text={transcript} /> : null}
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
