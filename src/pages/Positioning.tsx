import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBizMessage } from '../api/client';
import {
  PROFILE_FIELD_KEYS,
  createFaq,
  createTopicFromFaq,
  deleteFaq,
  getActiveProfile,
  interviewHistory,
  listFaqs,
  reorderFaqs,
  updateFaq,
  updateProfileFields,
  type ActiveProfileView,
  type FaqView,
  type InterviewHistoryView,
  type ProfileFieldKey,
} from '../api/profile';
import { shouldShowReplay } from './positioningMode';
import { faqDraftError, moveFaq } from './faqMode';
import {
  PROFILE_FIELD_HINTS,
  PROFILE_FIELD_LABELS,
  draftErrors,
  draftToPatch,
  isListField,
  readProfileFields,
  toFieldDraft,
  type ProfileFieldDraft,
} from '../lib/profileFields';

/**
 * 账号定位 `/positioning`——对齐原型「账号定位」段
 * （`prototypes/extracted/sections/11-账号定位.html`，条件 `{{ isPos }}`）。
 *
 * <p>两态：未校准 → 三步引导 + 开始校准；已校准 → 七字段档案 + 高频问答。
 *
 * <p>**档案是唯一真源**（D19）：七个字段全都在这一页可见可改，走 `PUT /api/profile/fields`；
 * 创作页「人设声音」改的是同一份数据的三字段投影。旧中文键档案由 `readProfileFields` 映射后展示。
 *
 * <p>**高频问答属于定位档案**（D20），在这一页维护而不是在选题库——它是「你的观众常问什么」，
 * 是选题的来源之一，用户点「生成选题」才进选题库（不自动塞）。
 */

const FIELD_ROWS: ProfileFieldKey[] = [...PROFILE_FIELD_KEYS];

export default function Positioning() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileFieldDraft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [faqMsg, setFaqMsg] = useState<string | null>(null);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });
  const [editFaqId, setEditFaqId] = useState<number | null>(null);
  const [faqDraft, setFaqDraft] = useState({ question: '', answer: '' });

  const { data, isLoading, error } = useQuery<ActiveProfileView>({
    queryKey: ['profile'],
    queryFn: getActiveProfile,
  });
  const { data: history, isLoading: historyLoading } = useQuery<InterviewHistoryView>({
    queryKey: ['profile', 'interview-history'],
    queryFn: interviewHistory,
    enabled: data?.calibrated === true, // 未校准不发（避免多余请求）
  });
  const { data: faqs } = useQuery<FaqView[]>({
    queryKey: ['profile', 'faqs'],
    queryFn: listFaqs,
    enabled: data?.calibrated === true,
  });

  const profile = readProfileFields(data?.content);

  // 档案字段保存：只提交改动的键（部分更新）。成功后只失效档案本身——
  // exact 是有意的：FAQ 列表与回放挂在 ['profile', …] 下，改口吻不该顺手重拉它们。
  const fieldsMut = useMutation({
    mutationFn: (patch: Parameters<typeof updateProfileFields>[0]) => updateProfileFields(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'], exact: true });
      setEditing(false);
      setDraft(null);
      setSaveError(null);
    },
    onError: (e: unknown) => setSaveError(getBizMessage(e, '保存失败')),
  });

  // exact 同理：FAQ 变了不代表档案本身或回放变了，别把 ['profile'] 整棵子树一起重拉。
  const invalidateFaqs = () =>
    void queryClient.invalidateQueries({ queryKey: ['profile', 'faqs'], exact: true });

  const createFaqMut = useMutation({
    mutationFn: (v: { question: string; answer?: string }) => createFaq(v.question, v.answer),
    onSuccess: () => {
      invalidateFaqs();
      setNewFaq({ question: '', answer: '' });
      setFaqError(null);
      setFaqMsg('已添加');
    },
    onError: (e: unknown) => setFaqError(getBizMessage(e, '添加失败')),
  });

  const updateFaqMut = useMutation({
    mutationFn: (v: { id: number; question: string; answer?: string }) =>
      updateFaq(v.id, v.question, v.answer),
    onSuccess: () => {
      invalidateFaqs();
      setEditFaqId(null);
      setFaqError(null);
      setFaqMsg('已保存');
    },
    onError: (e: unknown) => setFaqError(getBizMessage(e, '保存失败')),
  });

  const deleteFaqMut = useMutation({
    mutationFn: (id: number) => deleteFaq(id),
    onSuccess: () => {
      invalidateFaqs();
      setFaqError(null);
      setFaqMsg('已删除——由它生成的选题保留在选题库');
    },
    onError: (e: unknown) => setFaqError(getBizMessage(e, '删除失败')),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: number[]) => reorderFaqs(ids),
    onSuccess: () => {
      invalidateFaqs();
      setFaqError(null);
    },
    onError: (e: unknown) => setFaqError(getBizMessage(e, '排序失败')),
  });

  const faqTopicMut = useMutation({
    mutationFn: (id: number) => createTopicFromFaq(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['topics'], exact: true });
      setFaqError(null);
      setFaqMsg('已写入选题库，可去「选题库」生成文案');
    },
    onError: (e: unknown) => setFaqError(getBizMessage(e, '生成选题失败')),
  });

  const openEditor = () => {
    setDraft(toFieldDraft(profile));
    setSaveError(null);
    setEditing(true);
  };

  // 取消：只丢本地草稿。**不发请求、不动 Query cache**——不存在「边输入边污染档案」的中间态。
  //
  // 保存中不许取消：PUT 一旦发出就拦不住（服务端可能已提交），此时清掉草稿关掉编辑器，用户看到的
  // 是「我取消了」，而成功回调随后照样 invalidate 并刷出刚才那次改动。宁可禁用按钮，
  // 也不给一个撤不回来的撤销。
  const cancelEditor = () => {
    if (fieldsMut.isPending) return;
    setEditing(false);
    setDraft(null);
    setSaveError(null);
  };

  const errors = draft ? draftErrors(draft, profile) : {};
  const patch = draft ? draftToPatch(draft, profile) : {};
  const patchKeys = Object.keys(patch);

  const saveFields = () => {
    if (!draft) return;
    const firstError = FIELD_ROWS.map((k) => errors[k]).find(Boolean);
    if (firstError) {
      setSaveError(firstError);
      return;
    }
    if (patchKeys.length === 0) {
      cancelEditor(); // 一处没改：直接关掉，不发请求
      return;
    }
    fieldsMut.mutate(patch);
  };

  const startEditFaq = (f: FaqView) => {
    setEditFaqId(f.id);
    setFaqDraft({ question: f.question, answer: f.answer ?? '' });
    setFaqError(null);
    setFaqMsg(null);
  };

  const submitNewFaq = () => {
    const err = faqDraftError(newFaq.question, newFaq.answer);
    if (err) {
      setFaqError(err);
      return;
    }
    setFaqMsg(null);
    createFaqMut.mutate({
      question: newFaq.question.trim(),
      answer: newFaq.answer.trim() || undefined,
    });
  };

  const submitEditFaq = () => {
    if (editFaqId == null) return;
    const err = faqDraftError(faqDraft.question, faqDraft.answer);
    if (err) {
      setFaqError(err);
      return;
    }
    setFaqMsg(null);
    updateFaqMut.mutate({
      id: editFaqId,
      question: faqDraft.question.trim(),
      answer: faqDraft.answer.trim() || undefined,
    });
  };

  const move = (id: number, dir: 'up' | 'down') => {
    const ids = moveFaq(faqs ?? [], id, dir);
    if (!ids) return; // 点到头了：不发请求
    setFaqMsg(null);
    reorderMut.mutate(ids);
  };

  const faqBusy =
    createFaqMut.isPending ||
    updateFaqMut.isPending ||
    deleteFaqMut.isPending ||
    reorderMut.isPending ||
    faqTopicMut.isPending;

  return (
    <div className="mx-auto max-w-[1040px]">
      <h1 className="mb-1 font-serif text-title font-black">账号定位</h1>
      <p className="mb-5 text-lead text-paper-muted">
        这份定位档案是所有智能体的公共上下文——选题、创作、拆解都基于它工作
      </p>

      {isLoading ? (
        <p className="text-copy text-paper-muted">加载中…</p>
      ) : error ? (
        <p className="text-copy text-paper-danger">定位档案加载失败，请刷新重试。</p>
      ) : !data?.calibrated ? (
        <div className="rounded-block border border-paper-line bg-paper-card px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[20px] font-black">你的账号还没有定位档案</p>
          <p className="mb-[26px] text-lead leading-[1.8] text-paper-muted">
            没有定位档案，AI 只能写出「谁都能用」的通用文案
            <br />
            花 15 分钟聊一次，之后每条稿子都像你本人写的
          </p>
          <div className="mx-auto mb-7 grid max-w-[640px] grid-cols-3 gap-3 text-caption">
            {[
              ['① 贴个链接', '主页/过往文案任意一样，AI 先猜一版你的人设'],
              ['② 聊几个问题', '像访谈一样一问一答，支持语音，大白话即可'],
              ['③ 立刻见效', '当场对比「有/无定位」两版文案的差别'],
            ].map(([t, d]) => (
              <div
                key={t}
                className="rounded-panel border border-paper-tintDeep bg-paper-sunken p-3.5 text-left"
              >
                <div className="mb-1 font-bold">{t}</div>
                <div className="leading-normal text-paper-muted">{d}</div>
              </div>
            ))}
          </div>
          <Link
            to="/calibrate"
            className="inline-block rounded-card bg-paper-primary px-10 py-3.5 text-[15px] text-white hover:bg-paper-primaryHover hover:text-white"
          >
            开始定位校准
          </Link>
          <p className="mt-3 text-meta text-paper-mutedLight">
            约 15 分钟 · 不消耗额度 · 随时可以重新校准
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_340px] gap-[18px]">
          <div className="flex flex-col gap-3.5">
            <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
              <div className="mb-3.5 flex items-baseline justify-between gap-3">
                <h2 className="font-sans text-copy font-bold">定位档案</h2>
                <div className="flex items-baseline gap-3">
                  <span className="text-hint text-paper-success">
                    ✓ 已校准
                    {data.version ? ` · 第 ${data.version} 版` : ''}
                    {data.calibratedAt
                      ? ` · ${new Date(data.calibratedAt).toLocaleDateString()}`
                      : ''}
                  </span>
                  {!editing && (
                    <button
                      type="button"
                      onClick={openEditor}
                      className="text-meta text-paper-primary hover:text-paper-primaryHover"
                    >
                      编辑档案
                    </button>
                  )}
                </div>
              </div>

              {saveError && (
                <p
                  role="alert"
                  className="mb-3 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
                >
                  {saveError}
                </p>
              )}

              {editing && draft ? (
                <div className="flex flex-col gap-3">
                  <p className="text-caption text-paper-muted">
                    改完点「保存」才生效——只有你动过的字段会被更新。红线与内容支柱一行一条。
                  </p>
                  {FIELD_ROWS.map((key) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-hint font-bold text-paper-primary">
                        {PROFILE_FIELD_LABELS[key]}
                        {isListField(key) && (
                          <span className="ml-1 font-normal text-paper-mutedLight">（一行一条）</span>
                        )}
                      </span>
                      <textarea
                        rows={isListField(key) ? 3 : 2}
                        value={draft[key]}
                        placeholder={PROFILE_FIELD_HINTS[key]}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                        className={`w-full rounded-card border bg-paper-sunken px-3.5 py-2.5 text-copy leading-normal text-paper-ink outline-none focus:border-paper-primary ${
                          errors[key] ? 'border-paper-dangerLine' : 'border-paper-lineStrong'
                        }`}
                      />
                      {errors[key] && (
                        <span className="mt-1 block text-hint text-paper-danger">{errors[key]}</span>
                      )}
                    </label>
                  ))}
                  <div className="flex items-center justify-end gap-2.5">
                    <span className="mr-auto text-hint text-paper-mutedLight">
                      {patchKeys.length > 0
                        ? `将更新 ${patchKeys.length} 个字段`
                        : '还没有改动'}
                    </span>
                    <button
                      type="button"
                      disabled={fieldsMut.isPending}
                      onClick={cancelEditor}
                      className="rounded-card border border-paper-lineStrong px-5 py-2 text-copy text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={fieldsMut.isPending}
                      onClick={saveFields}
                      className="rounded-panel bg-paper-primary px-5 py-2 text-copy text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {fieldsMut.isPending ? '保存中…' : '保存'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-copy">
                  {FIELD_ROWS.map((key) => {
                    const value = profile[key];
                    const list = isListField(key) ? ((value as string[] | undefined) ?? []) : null;
                    return (
                      <div
                        key={key}
                        className={`rounded-card border px-3.5 py-3 ${
                          key === 'redlines'
                            ? 'border-paper-dangerLine bg-paper-dangerTint'
                            : 'border-paper-tintDeep bg-paper-sunken'
                        } ${key === 'contentPillars' ? 'col-span-2' : ''}`}
                      >
                        <div
                          className={`mb-1 text-hint font-bold ${
                            key === 'redlines' ? 'text-paper-danger' : 'text-paper-primary'
                          }`}
                        >
                          {PROFILE_FIELD_LABELS[key]}
                        </div>
                        {list ? (
                          list.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {list.map((item) => (
                                <span
                                  key={item}
                                  className="rounded-tag border border-paper-lineStrong bg-paper-card px-2 py-[3px] text-hint text-paper-inkSoft"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-paper-mutedLight">档案里没有这一项</span>
                          )
                        ) : (
                          <div className="leading-normal">
                            {(value as string | undefined)?.trim() || (
                              <span className="text-paper-mutedLight">档案里没有这一项</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-block border border-paper-line bg-paper-card px-6 py-5">
              <h2 className="mb-1 font-sans text-copy font-bold">
                高频问答
                <span className="ml-2 text-hint font-normal text-paper-muted">
                  观众常问的问题——每条都能一键变成选题
                </span>
              </h2>
              <p className="mb-3.5 text-caption text-paper-muted">
                顺序由你决定（不代表咨询频率）。答案可以先空着，想起来再补。
              </p>

              {faqError && (
                <p
                  role="alert"
                  className="mb-3 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger"
                >
                  {faqError}
                </p>
              )}
              {faqMsg && !faqError && (
                <p className="mb-3 text-meta text-paper-muted">{faqMsg}</p>
              )}

              {(faqs ?? []).length === 0 ? (
                <p className="mb-3.5 rounded-card border border-dashed border-paper-lineStrong px-3.5 py-4 text-caption text-paper-mutedLight">
                  还没有高频问答。校准时 AI 会从访谈里提取候选给你勾选，也可以在下面手动添加。
                </p>
              ) : (
                <ul className="mb-3.5 flex flex-col gap-2.5">
                  {(faqs ?? []).map((f, i) => (
                    <li
                      key={f.id}
                      className="rounded-card border border-paper-tintDeep bg-paper-sunken px-3.5 py-3"
                    >
                      {editFaqId === f.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            value={faqDraft.question}
                            onChange={(e) =>
                              setFaqDraft({ ...faqDraft, question: e.target.value })
                            }
                            placeholder="观众常问的问题"
                            className="w-full rounded-card border border-paper-lineStrong bg-paper-card px-3 py-2 text-copy outline-none focus:border-paper-primary"
                          />
                          <textarea
                            rows={2}
                            value={faqDraft.answer}
                            onChange={(e) => setFaqDraft({ ...faqDraft, answer: e.target.value })}
                            placeholder="你平时怎么回答（可留空）"
                            className="w-full rounded-card border border-paper-lineStrong bg-paper-card px-3 py-2 text-copy outline-none focus:border-paper-primary"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditFaqId(null);
                                setFaqError(null);
                              }}
                              className="rounded-chip border border-paper-lineStrong px-3.5 py-[6px] text-hint text-paper-inkSoft hover:border-paper-primary"
                            >
                              取消
                            </button>
                            <button
                              type="button"
                              disabled={faqBusy}
                              onClick={submitEditFaq}
                              className="rounded-chip bg-paper-primary px-3.5 py-[6px] text-hint text-white hover:bg-paper-primaryHover disabled:opacity-45"
                            >
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <span className="mt-[2px] shrink-0 text-hint text-paper-mutedLight">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-copy font-medium leading-normal text-paper-ink">
                              {f.question}
                            </div>
                            <div className="mt-1 text-caption leading-normal text-paper-muted">
                              {f.answer?.trim() || '答案还没写——生成文案时 AI 会按档案口吻替你说'}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              disabled={faqBusy || i === 0}
                              onClick={() => move(f.id, 'up')}
                              aria-label="上移"
                              className="rounded-chip border border-paper-lineStrong px-2 py-[5px] text-hint text-paper-inkSoft hover:border-paper-primary disabled:opacity-35"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={faqBusy || i === (faqs ?? []).length - 1}
                              onClick={() => move(f.id, 'down')}
                              aria-label="下移"
                              className="rounded-chip border border-paper-lineStrong px-2 py-[5px] text-hint text-paper-inkSoft hover:border-paper-primary disabled:opacity-35"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              disabled={faqBusy}
                              onClick={() => faqTopicMut.mutate(f.id)}
                              className="rounded-chip border border-paper-primary px-3 py-[5px] text-hint text-paper-primary hover:bg-paper-tint disabled:opacity-45"
                            >
                              生成选题
                            </button>
                            <button
                              type="button"
                              disabled={faqBusy}
                              onClick={() => startEditFaq(f)}
                              className="rounded-chip border border-paper-lineStrong px-3 py-[5px] text-hint text-paper-inkSoft hover:border-paper-primary disabled:opacity-45"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              disabled={faqBusy}
                              onClick={() => deleteFaqMut.mutate(f.id)}
                              className="rounded-chip border border-paper-lineStrong px-3 py-[5px] text-hint text-paper-muted hover:border-paper-danger hover:text-paper-danger disabled:opacity-45"
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2 rounded-card border border-dashed border-paper-goldSoft bg-paper-tint px-3.5 py-3">
                <input
                  value={newFaq.question}
                  onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                  placeholder="再添一条观众常问的问题…"
                  className="w-full rounded-card border border-paper-lineStrong bg-paper-card px-3 py-2 text-copy outline-none focus:border-paper-primary"
                />
                <textarea
                  rows={2}
                  value={newFaq.answer}
                  onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                  placeholder="你平时怎么回答（可留空，答案后补）"
                  className="w-full rounded-card border border-paper-lineStrong bg-paper-card px-3 py-2 text-copy outline-none focus:border-paper-primary"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={faqBusy || !newFaq.question.trim()}
                    onClick={submitNewFaq}
                    className="rounded-chip bg-paper-primary px-4 py-[7px] text-copy text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {createFaqMut.isPending ? '添加中…' : '添加问答'}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <aside className="flex flex-col rounded-block border border-paper-line bg-paper-card p-5">
            <h2 className="mb-1 font-sans text-copy font-bold">建库引导对话</h2>
            <p className="mb-3.5 text-[11.5px] text-paper-muted">
              你注册时 15 分钟聊出来的档案，随时可以重聊校准
            </p>
            {shouldShowReplay(history?.found ?? false, history?.turns ?? null) ? (
              <div className="mb-3.5 flex flex-1 flex-col gap-2.5 text-caption">
                {history!.turns.map((t, i) => (
                  <div
                    key={i}
                    className={`max-w-[92%] rounded-[10px_10px_10px_2px] px-3 py-2.5 leading-relaxed ${
                      t.role === 'ai'
                        ? 'self-start bg-paper-tint text-paper-ink'
                        : 'self-end rounded-[10px_10px_2px_10px] bg-paper-ink text-paper-shadeDeep'
                    }`}
                  >
                    {t.text}
                  </div>
                ))}
              </div>
            ) : (
              <p className="flex-1 text-caption leading-normal text-paper-mutedLight">
                {historyLoading ? '加载中…' : '校准对话暂不可回放'}
              </p>
            )}
            <Link
              to="/calibrate"
              className="mt-3.5 rounded-card border border-paper-primary py-2.5 text-center text-copy text-paper-primary hover:bg-paper-tint"
            >
              重新校准定位
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
