import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BizError, getBizMessage } from '../api/client';
import { type CardSummary, listCards } from '../api/kb';
import {
  type ScriptDetail,
  type ScriptSummary,
  createTopic,
  editSentence,
  generateScript,
  getScript,
  listScripts,
  parseSection,
  rewriteSentence,
} from '../api/script';
import CreateInput from './create/CreateInput';
import CreateProgress from './create/CreateProgress';

/**
 * C 端创作页 {@code /create}：选选题 → 生成 → 多阶段进度动画 → 三段逐句渲染
 * （编辑 / 换个说法）+ 右栏引用卡片 + 历史稿件入口。
 *
 * <p>设计要点：
 * - 生成走 §4.1 额度事务链（30-60s），前端用进度动画「检索知识库 → 撰写 → 安全审核」掩盖等待（无流式，§5.1）。
 * - 单句「换个说法」调 rewrite-sentence 返回<b>预览</b>，可采用（→ PUT sentence 落库）/ 放弃 / 再换；
 *   被 block（CONTENT_BLOCKED）展示提示、原句保留。
 * - 引用卡片：生成响应带 citedCardIds，前端拉 B 层卡片列表匹配标题展示。
 */
type SectionKey = 'hook' | 'body' | 'cta';

const SECTION_LABELS: Record<SectionKey, string> = { hook: '钩子', body: '正文', cta: '转化' };

export default function Create() {
  const queryClient = useQueryClient();

  const { data: history } = useQuery<ScriptSummary[]>({
    queryKey: ['scripts', 'draft'],
    queryFn: () => listScripts('draft'),
  });

  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  // 新输入模型：自由 textarea + 时长 + 平台（Task 4 加平台 Tab）
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState<'45' | '90' | '180'>('45');
  const [platform, setPlatform] = useState<'douyin' | 'xhs' | 'gzh'>('douyin');

  const { data: bCards } = useQuery<CardSummary[]>({
    queryKey: ['kb-cards', 'B'],
    queryFn: () => listCards('B'),
    enabled: script != null && script.citedCardIds.length > 0,
  });

  const genMut = useMutation({
    mutationFn: (vars: { topicId: number; platform?: string; duration?: '45' | '90' | '180' }) =>
      generateScript(vars.topicId, vars.platform, vars.duration),
    onMutate: () => {
      setGenError(null);
    },
    onSuccess: (s) => {
      setScript(s);
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    },
    onError: (e: unknown) => {
      setGenError(getBizMessage(e, '生成失败'));
    },
  });

  // 自由 textarea → createTopic → generateScript(topicId, platform, duration)
  const handleGenerate = async () => {
    const t = topic.trim();
    if (!t || genMut.isPending) return;
    setScript(null);
    setGenError(null);
    try {
      const topicId = await createTopic(t, '');
      genMut.mutate({ topicId, platform, duration });
    } catch (e: unknown) {
      setGenError(getBizMessage(e, '创建选题失败'));
    }
  };

  const handleEdited = (s: ScriptDetail) => {
    setScript(s);
    queryClient.invalidateQueries({ queryKey: ['scripts'] });
  };

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-5 font-serif text-title font-black text-paper-ink">文案创作</h1>
      <CreateInput
        topic={topic}
        onTopic={setTopic}
        duration={duration}
        onDuration={setDuration}
        onGenerate={handleGenerate}
        generating={genMut.isPending}
      />

      {genMut.isPending && (
        <div className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-[30px] py-7.5 text-center">
          <p className="animate-pulse text-lead text-paper-primary">
            ① 检索知识库 → ② 撰写口播稿 → ③ 安全审核 · 约 30-60 秒，完成后整稿一次呈现
          </p>
        </div>
      )}
      <CreateProgress error={genError} />

      {!script && !genMut.isPending && (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body text-paper-mutedLight">
          输入选题后点击「生成口播稿」，AI 会结合你的账号档案和知识库卡片来写
        </div>
      )}
      {script && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_18rem]">
          <div className="flex flex-col gap-5">
            <ScriptEditor script={script} bCards={bCards ?? []} onEdited={handleEdited} />
          </div>
          <aside className="flex flex-col gap-5">
            {script.citedCardIds.length > 0 && (
              <section className="rounded-2xl border border-paper-line bg-paper-card p-5 shadow-sm">
                <h2 className="mb-3 font-serif text-sm font-bold text-paper-ink">引用卡片</h2>
                <ul className="flex flex-col gap-1.5">
                  {script.citedCardIds.map((cid) => {
                    const c = (bCards ?? []).find((x) => x.id === cid);
                    return (
                      <li
                        key={cid}
                        className="rounded-lg border border-paper-line bg-paper-base px-2.5 py-1.5 text-[12px] text-paper-ink"
                      >
                        {c ? c.title : `卡 #${cid}`}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
            <section className="rounded-2xl border border-paper-line bg-paper-card p-5 shadow-sm">
              <h2 className="mb-3 font-serif text-sm font-bold text-paper-ink">历史稿件</h2>
              {(!history || history.length === 0) && (
                <p className="text-[12px] text-paper-muted">暂无草稿稿件。</p>
              )}
              {history && history.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {history.map((s) => (
                    <li key={s.id}>
                      <Link
                        to="/review"
                        className="block rounded-lg border border-paper-line bg-paper-base px-2.5 py-1.5 text-[12px] text-paper-ink transition hover:bg-[#f7f2e7]"
                      >
                        #{s.id} · {s.platform} · {s.reviewState}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

/** 三段逐句编辑器：每句悬浮出「编辑」「换个说法」。 */
function ScriptEditor({
  script,
  bCards,
  onEdited,
}: {
  script: ScriptDetail;
  bCards: CardSummary[];
  onEdited: (s: ScriptDetail) => void;
}) {
  return (
    <section className="rounded-2xl border border-paper-line bg-paper-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-serif text-lg font-bold text-paper-ink">稿件 #{script.id}</h2>
        <span className="rounded-full border border-[#ecd4ae] bg-[#fdf3e4] px-2.5 py-1 text-[11px] font-bold text-[#a8712e]">
          {script.platform}
        </span>
      </div>
      <div className="flex flex-col gap-5">
        {(['hook', 'body', 'cta'] as SectionKey[]).map((key) => (
          <SectionEditor
            key={key}
            scriptId={script.id}
            section={key}
            sentences={parseSection(script[key])}
            fullScript={script}
            onEdited={onEdited}
          />
        ))}
      </div>
    </section>
  );
}

/** 单段编辑器：逐句渲染 + 编辑 / 换个说法。 */
function SectionEditor({
  scriptId,
  section,
  sentences,
  fullScript,
  onEdited,
}: {
  scriptId: number;
  section: SectionKey;
  sentences: { idx: number; text: string }[];
  fullScript: ScriptDetail;
  onEdited: (s: ScriptDetail) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [rewriteIdx, setRewriteIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rewriteMsg, setRewriteMsg] = useState<string | null>(null);

  const editMut = useMutation({
    mutationFn: (vars: { idx: number; text: string }) =>
      editSentence(scriptId, section, vars.idx, vars.text),
    onSuccess: () => {
      setEditingIdx(null);
      // 拉取最新稿件回灌
      getScript(scriptId).then(onEdited);
    },
    onError: (e: unknown) => setRewriteMsg(getBizMessage(e, '保存失败')),
  });

  const rewriteMut = useMutation({
    mutationFn: (vars: { idx: number }) => rewriteSentence(scriptId, section, vars.idx),
    onSuccess: (text) => {
      setPreview(text);
      setRewriteMsg(null);
    },
    onError: (e: unknown) => {
      if (e instanceof BizError && e.code === 5002) {
        setRewriteMsg('内容被安全拦截，原句保留');
      } else {
        setRewriteMsg(getBizMessage(e, '重写失败'));
      }
      setPreview(null);
    },
  });

  const startEdit = (idx: number, text: string) => {
    setEditingIdx(idx);
    setDraft(text);
    setRewriteIdx(null);
    setPreview(null);
    setRewriteMsg(null);
  };

  const startRewrite = (idx: number) => {
    setRewriteIdx(idx);
    setPreview(null);
    setRewriteMsg(null);
    rewriteMut.mutate({ idx });
  };

  const adoptPreview = () => {
    if (preview == null || rewriteIdx == null) return;
    editMut.mutate(
      { idx: rewriteIdx, text: preview },
      {
        onSuccess: () => {
          setRewriteIdx(null);
          setPreview(null);
        },
      },
    );
  };

  return (
    <div>
      <h3 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-paper-muted">
        {SECTION_LABELS[section]}
      </h3>
      {sentences.length === 0 && <p className="text-sm text-paper-muted">（无内容）</p>}
      <ol className="flex flex-col gap-1.5">
        {sentences.map((s) => (
          <li key={s.idx} className="group">
            {/* 编辑模式 */}
            {editingIdx === s.idx ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full rounded-lg border border-[#d8d2c4] bg-[#fdfcf8] px-3 py-2 text-sm text-paper-ink outline-none focus:border-paper-primary"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editMut.mutate({ idx: s.idx, text: draft })}
                    disabled={editMut.isPending}
                    className="rounded-lg bg-paper-primary px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#6e4620] disabled:opacity-45"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIdx(null)}
                    className="rounded-lg border border-[#d8c9b2] bg-paper-card px-3 py-1.5 text-[12px] font-bold text-paper-primary transition hover:bg-[#f7f2e7]"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : rewriteIdx === s.idx ? (
              // 换个说法预览模式
              <div className="flex flex-col gap-1.5 rounded-lg border border-[#ecd4ae] bg-[#fdf3e4] px-3 py-2">
                {preview != null ? (
                  <p className="text-sm text-paper-ink">{preview}</p>
                ) : (
                  <p className="text-sm text-paper-muted">重写中…</p>
                )}
                {rewriteMsg && (
                  <p className="text-[12px] text-[#b0492f]">{rewriteMsg}</p>
                )}
                {preview != null && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={adoptPreview}
                      disabled={editMut.isPending}
                      className="rounded-lg bg-paper-primary px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-[#6e4620] disabled:opacity-45"
                    >
                      采用
                    </button>
                    <button
                      type="button"
                      onClick={() => startRewrite(s.idx)}
                      disabled={rewriteMut.isPending}
                      className="rounded-lg border border-[#d8c9b2] bg-paper-card px-3 py-1.5 text-[12px] font-bold text-paper-primary transition hover:bg-[#f7f2e7] disabled:opacity-45"
                    >
                      再换
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRewriteIdx(null);
                        setPreview(null);
                      }}
                      className="rounded-lg border border-[#d8c9b2] bg-paper-card px-3 py-1.5 text-[12px] font-bold text-paper-primary transition hover:bg-[#f7f2e7]"
                    >
                      放弃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // 普通展示模式
              <div className="flex items-start gap-2 rounded-lg px-3 py-2 transition hover:bg-[#f7f2e7]/60">
                <span className="mt-0.5 text-[11px] font-bold text-paper-muted">{s.idx + 1}.</span>
                <p className="flex-1 text-[15px] leading-relaxed text-paper-ink">{s.text}</p>
                <span className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(s.idx, s.text)}
                    className="rounded-md border border-[#d8c9b2] bg-paper-card px-2 py-1 text-[11px] font-bold text-paper-primary transition hover:bg-[#f7f2e7]"
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => startRewrite(s.idx)}
                    disabled={rewriteMut.isPending}
                    className="rounded-md border border-[#d8c9b2] bg-paper-card px-2 py-1 text-[11px] font-bold text-paper-primary transition hover:bg-[#f7f2e7] disabled:opacity-45"
                  >
                    换个说法
                  </button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** 新建选题已并入 CreateInput 自由 textarea（→ createTopic → generate），此弹窗移除。 */
