import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import {
  CONTENT_SOURCE_LABELS,
  CONTENT_SOURCES,
  CONTENT_STATE_LABELS,
  CONTENT_STATES,
  PLATFORM_LABELS,
  PLATFORMS,
  createContent,
  deleteContent,
  getContent,
  listContents,
  registerPublication,
  updateContent,
  type ContentFilters,
  type ContentSource,
  type ContentState,
  type ContentSummary,
  type Platform,
  type PublicationView,
} from '../api/content';
import { validateLinkInput } from './analyze/helpers';
import { canEditInLibrary, isLibraryEmpty, platformLabel } from './kbMode';

export default function KB() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const focusId = Number(params.get('content')) || null;
  const [q, setQ] = useState('');
  const [source, setSource] = useState<ContentSource | ''>('');
  const [state, setState] = useState<ContentState | ''>('');
  const [platform, setPlatform] = useState<Platform | ''>('');
  const [editor, setEditor] = useState<{ id?: number; title: string; body: string } | null>(null);
  const [registerFor, setRegisterFor] = useState<number | null>(null);
  const [regPlatform, setRegPlatform] = useState<Platform>('douyin');
  const [regUrl, setRegUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(focusId);

  const filters: ContentFilters = useMemo(
    () => ({
      q: q.trim() || undefined,
      source: source || undefined,
      state: state || undefined,
      platform: platform || undefined,
    }),
    [q, source, state, platform],
  );

  const { data: items, isLoading, error } = useQuery<ContentSummary[]>({
    queryKey: ['contents', filters],
    queryFn: () => listContents(filters),
  });

  const { data: detail } = useQuery({
    queryKey: ['content', detailId],
    queryFn: () => getContent(detailId!),
    enabled: detailId != null,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['contents'] });
    void qc.invalidateQueries({ queryKey: ['content'] });
    void qc.invalidateQueries({ queryKey: ['review'] });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!editor) return;
      if (editor.id) await updateContent(editor.id, editor.title, editor.body);
      else await createContent(editor.title, editor.body);
    },
    onSuccess: () => {
      setEditor(null);
      setFormError(null);
      invalidate();
    },
    onError: (e: unknown) => setFormError(getBizMessage(e, '保存失败')),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteContent(id),
    onSuccess: () => {
      setDetailId(null);
      invalidate();
    },
    onError: (e: unknown) => setFormError(getBizMessage(e, '删除失败')),
  });

  const regMut = useMutation({
    mutationFn: () => {
      const v = validateLinkInput(regUrl);
      if (!v.ok) throw new Error(v.message);
      return registerPublication(registerFor!, regPlatform, v.url);
    },
    onSuccess: () => {
      setRegisterFor(null);
      setRegUrl('');
      setFormError(null);
      invalidate();
    },
    onError: (e: unknown) => setFormError(getBizMessage(e, '登记失败')),
  });

  const empty = isLibraryEmpty(items ?? []);

  return (
    <main className="mx-auto min-h-full max-w-[880px] px-5 py-8">
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="font-serif text-title font-black text-paper-ink">
          知识库
          <span className="ml-2 font-sans text-copy font-normal text-paper-mutedLight">
            {items ? `${items.length} 篇内容` : ''}
          </span>
        </h1>
        <button
          type="button"
          onClick={() => {
            setEditor({ title: '', body: '' });
            setFormError(null);
          }}
          className="rounded-panel bg-paper-primary px-5 py-2.5 text-body text-white hover:bg-paper-primaryHover"
        >
          + 新建内容
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索标题或正文"
          className="rounded-card border border-paper-lineStrong bg-paper-sunken px-3 py-2 text-copy outline-none focus:border-paper-primary"
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as ContentSource | '')}
          className="rounded-card border border-paper-lineStrong bg-paper-card px-2 py-2 text-copy"
        >
          <option value="">全部来源</option>
          {CONTENT_SOURCES.map((s) => (
            <option key={s} value={s}>
              {CONTENT_SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={state}
          onChange={(e) => setState(e.target.value as ContentState | '')}
          className="rounded-card border border-paper-lineStrong bg-paper-card px-2 py-2 text-copy"
        >
          <option value="">全部状态</option>
          {CONTENT_STATES.map((s) => (
            <option key={s} value={s}>
              {CONTENT_STATE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform | '')}
          className="rounded-card border border-paper-lineStrong bg-paper-card px-2 py-2 text-copy"
        >
          <option value="">全部平台</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      {formError && <p className="mb-3 text-copy text-paper-danger">{formError}</p>}
      {isLoading && <p className="py-10 text-center text-body text-paper-muted">加载中…</p>}
      {error && (
        <p className="py-10 text-center text-body text-paper-danger">加载失败：{getBizMessage(error)}</p>
      )}

      {empty && !isLoading && !error && (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black text-paper-ink">知识库还是空的</p>
          <p className="mb-5 text-body leading-loose text-paper-inkSoft">
            知识库是你写过的内容底仓。手写一篇，或在创作页采用某个平台版本后入库。
          </p>
          <button
            type="button"
            onClick={() => setEditor({ title: '', body: '' })}
            className="rounded-panel bg-paper-primary px-6 py-3 text-body text-white hover:bg-paper-primaryHover"
          >
            先写一篇
          </button>
        </div>
      )}

      {!empty && !isLoading && (
        <div className="flex flex-col gap-2.5">
          {(items ?? []).map((c) => (
            <article
              key={c.id}
              className="rounded-panel border border-paper-line bg-paper-card px-5 py-4"
            >
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailId(c.id === detailId ? null : c.id)}
                  className="text-left text-lead font-medium text-paper-ink hover:text-paper-primary"
                >
                  {c.title}
                </button>
                <span className="rounded-tag border border-paper-lineStrong px-2 py-px text-hint">
                  {CONTENT_SOURCE_LABELS[c.source]}
                </span>
                <span className="rounded-tag border border-paper-lineStrong px-2 py-px text-hint">
                  {CONTENT_STATE_LABELS[c.state]}
                </span>
                <span className="text-hint text-paper-muted">{platformLabel(c.platform)}</span>
              </div>
              <p className="mb-3 line-clamp-2 text-caption text-paper-inkSoft">{c.excerpt}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRegisterFor(c.id);
                    setRegPlatform(c.platform ?? 'douyin');
                    setRegUrl('');
                    setFormError(null);
                  }}
                  className="rounded-chip border border-paper-primary px-3 py-1 text-copy text-paper-primary"
                >
                  登记发布
                </button>
                {canEditInLibrary(c.source) ? (
                  <button
                    type="button"
                    onClick={() => {
                      void getContent(c.id).then((d) =>
                        setEditor({ id: d.id, title: d.title, body: d.body }),
                      );
                    }}
                    className="rounded-chip border border-paper-lineStrong px-3 py-1 text-copy"
                  >
                    编辑
                  </button>
                ) : (
                  <Link
                    to={`/create?content=${c.id}`}
                    className="rounded-chip border border-paper-lineStrong px-3 py-1 text-copy"
                  >
                    去创作页改
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => delMut.mutate(c.id)}
                  className="rounded-chip border border-paper-lineStrong px-3 py-1 text-copy text-paper-muted"
                >
                  删除
                </button>
              </div>
              {detailId === c.id && detail && detail.id === c.id && (
                <PublicationList pubs={detail.publications} />
              )}
            </article>
          ))}
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[560px] rounded-block border border-paper-line bg-paper-card p-6">
            <h2 className="mb-3 font-serif text-sub font-black">
              {editor.id ? '编辑内容' : '新建内容'}
            </h2>
            <input
              value={editor.title}
              onChange={(e) => setEditor({ ...editor, title: e.target.value })}
              placeholder="标题"
              className="mb-2 w-full rounded-card border border-paper-lineStrong px-3 py-2 text-lead outline-none"
            />
            <textarea
              value={editor.body}
              onChange={(e) => setEditor({ ...editor, body: e.target.value })}
              placeholder="Markdown 正文"
              rows={10}
              className="mb-3 w-full rounded-card border border-paper-lineStrong px-3 py-2 text-copy outline-none"
            />
            {formError && <p className="mb-2 text-copy text-paper-danger">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !editor.title.trim()}
                className="rounded-card bg-paper-primary px-5 py-2 text-white disabled:opacity-45"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!saveMut.isPending) setEditor(null);
                }}
                className="rounded-card border border-paper-lineStrong px-5 py-2"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {registerFor != null && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-[440px] rounded-block border border-paper-line bg-paper-card p-6">
            <h2 className="mb-2 font-serif text-sub font-black">登记发布</h2>
            <p className="mb-3 text-caption text-paper-muted">只保存平台和链接，不会抓数据。复盘请到发布复盘页点「复盘」。</p>
            <div className="mb-2 flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRegPlatform(p)}
                  className={
                    regPlatform === p
                      ? 'rounded-badge border border-paper-primary bg-paper-tint px-3 py-1 text-copy text-paper-primary'
                      : 'rounded-badge border border-paper-lineStrong px-3 py-1 text-copy'
                  }
                >
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
            <textarea
              value={regUrl}
              onChange={(e) => setRegUrl(e.target.value)}
              placeholder="粘贴抖音或视频号分享文案"
              rows={3}
              className="mb-3 w-full rounded-card border border-paper-lineStrong px-3 py-2 text-copy"
            />
            {formError && <p className="mb-2 text-copy text-paper-danger">{formError}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => regMut.mutate()}
                disabled={regMut.isPending || !regUrl.trim()}
                className="rounded-card bg-paper-primary px-5 py-2 text-white disabled:opacity-45"
              >
                登记
              </button>
              <button type="button" onClick={() => setRegisterFor(null)} className="rounded-card border px-5 py-2">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PublicationList({ pubs }: { pubs: PublicationView[] }) {
  if (pubs.length === 0) {
    return <p className="mt-3 text-meta text-paper-muted">还没有发布记录。</p>;
  }
  return (
    <ul className="mt-3 flex flex-col gap-1.5 border-t border-paper-tintDeep pt-3">
      {pubs.map((p) => (
        <li key={p.id} className="text-meta text-paper-inkSoft">
          {PLATFORM_LABELS[p.platform]} · {p.state} · {p.publishUrl}
          {p.reviewedAt == null && ' · 五码为空，待复盘'}
        </li>
      ))}
    </ul>
  );
}
