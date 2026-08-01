import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BizError, getBizMessage } from '../../api/client';
import { editSentence, getScript, rewriteSentence, type ScriptDetail } from '../../api/script';
import { SECTION_LABELS, type SectionKey } from './types';

/**
 * 单段逐句编辑器：每句悬浮出「编辑」「换个说法」。对齐原型 13 段逐句打磨（保留真 API：
 * editSentence / rewriteSentence）。从 Create.tsx 抽出 + 令牌化。
 */
export default function SectionEditor({
  scriptId,
  section,
  sentences,
  onEdited,
}: {
  scriptId: number;
  section: SectionKey;
  sentences: { idx: number; text: string }[];
  onEdited: (s: ScriptDetail) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [rewriteIdx, setRewriteIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rewriteMsg, setRewriteMsg] = useState<string | null>(null);

  const editMut = useMutation({
    mutationFn: (vars: { idx: number; text: string }) => editSentence(scriptId, section, vars.idx, vars.text),
    onSuccess: () => {
      setEditingIdx(null);
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
      if (e instanceof BizError && e.code === 5002) setRewriteMsg('内容被安全拦截，原句保留');
      else setRewriteMsg(getBizMessage(e, '重写失败'));
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
      { onSuccess: () => { setRewriteIdx(null); setPreview(null); } },
    );
  };

  const secondaryBtn =
    'rounded-card border border-paper-goldPale bg-paper-tint px-3 py-1.5 text-meta font-bold text-paper-primary hover:border-paper-primary';

  return (
    <div>
      <h3 className="mb-2 text-meta font-bold uppercase tracking-wide text-paper-muted">
        {SECTION_LABELS[section]}
      </h3>
      {sentences.length === 0 && <p className="text-body text-paper-muted">（无内容）</p>}
      <ol className="flex flex-col gap-1.5">
        {sentences.map((s) => (
          <li key={s.idx} className="group">
            {editingIdx === s.idx ? (
              <div className="flex flex-col gap-1.5">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3 py-2 text-body text-paper-ink outline-none focus:border-paper-primary"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => editMut.mutate({ idx: s.idx, text: draft })} disabled={editMut.isPending} className="rounded-card bg-paper-primary px-3 py-1.5 text-meta font-bold text-white hover:bg-paper-primaryHover disabled:opacity-45">保存</button>
                  <button type="button" onClick={() => setEditingIdx(null)} className={secondaryBtn}>取消</button>
                </div>
              </div>
            ) : rewriteIdx === s.idx ? (
              <div className="flex flex-col gap-1.5 rounded-card border border-paper-goldPale bg-paper-tint px-3 py-2">
                {preview != null ? (
                  <p className="text-body text-paper-ink">{preview}</p>
                ) : (
                  <p className="text-body text-paper-muted">重写中…</p>
                )}
                {rewriteMsg && <p className="text-meta text-paper-danger">{rewriteMsg}</p>}
                {preview != null && (
                  <div className="flex gap-2">
                    <button type="button" onClick={adoptPreview} disabled={editMut.isPending} className="rounded-card bg-paper-primary px-3 py-1.5 text-meta font-bold text-white hover:bg-paper-primaryHover disabled:opacity-45">采用</button>
                    <button type="button" onClick={() => startRewrite(s.idx)} disabled={rewriteMut.isPending} className={`${secondaryBtn} disabled:opacity-45`}>再换</button>
                    <button type="button" onClick={() => { setRewriteIdx(null); setPreview(null); }} className={secondaryBtn}>放弃</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-card px-3 py-2 transition hover:bg-paper-tint/60">
                <span className="mt-0.5 text-hint font-bold text-paper-muted">{s.idx + 1}.</span>
                <p className="flex-1 text-sub leading-relaxed text-paper-ink">{s.text}</p>
                <span className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100">
                  <button type="button" onClick={() => startEdit(s.idx, s.text)} className="rounded-chip border border-paper-goldPale bg-paper-card px-2 py-1 text-hint font-bold text-paper-primary hover:bg-paper-tint">编辑</button>
                  <button type="button" onClick={() => startRewrite(s.idx)} disabled={rewriteMut.isPending} className="rounded-chip border border-paper-goldPale bg-paper-card px-2 py-1 text-hint font-bold text-paper-primary hover:bg-paper-tint disabled:opacity-45">换个说法</button>
                </span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
