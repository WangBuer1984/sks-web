import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BizError, getBizMessage } from '../api/client';
import { type CardLayer, type CardSummary, createCard, deleteCard, listCards, updateCard } from '../api/kb';
import { displayContent, wrapContent } from '../lib/kbText';
import { isKbEmpty, partitionByLayer } from './kbMode';

/**
 * C 端知识库页 {@code /kb}：A/B/C 三层三列网格（全可见，去 tab）+ deferred 诚实占位 + 引用保护删除。
 *
 * <p>对齐原型 15-知识库.html：A 层人设声音 / B 层业务事实 三列网格；缺卡提醒位 + C 层 stat
 * 占位（规划中，无 API）；dashed 空态（A+B=0，先完成定位校准 / 直接回答问题建卡 disabled）。
 * 保留 CardModal（A/B 新建编辑）+ 删除二次确认（code=4006 CARD_IN_USE → force 软删）。
 */

type ABLayer = 'A' | 'B';

const EYEBROWS: Record<ABLayer, string> = {
  A: 'A 层 · 人设声音（每次生成必用）',
  B: 'B 层 · 业务事实（按选题检索）',
};
const LAYER_HINTS: Record<ABLayer, string> = {
  A: 'A 层：定位画像，不做语义检索。',
  B: 'B 层：产品/选题知识，保存即重算向量，立即生效。',
};

export default function KB() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<CardSummary | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CardSummary | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: cards, isLoading, error } = useQuery<CardSummary[]>({
    queryKey: ['kb-cards'],
    queryFn: () => listCards(),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['kb-cards'] });

  const createMut = useMutation({
    mutationFn: (vars: { layer: CardLayer; cardType: string; title: string; content: string }) =>
      createCard(vars.layer, vars.cardType, vars.title, vars.content),
    onSuccess: () => { setShowModal(false); setFormError(null); invalidate(); },
    onError: (e: unknown) => setFormError(getBizMessage(e, '新建失败')),
  });
  const updateMut = useMutation({
    mutationFn: (vars: { id: number; title: string; content: string }) =>
      updateCard(vars.id, vars.title, vars.content),
    onSuccess: () => { setShowModal(false); setEditing(null); setFormError(null); invalidate(); },
    onError: (e: unknown) => setFormError(getBizMessage(e, '保存失败')),
  });
  const deleteMut = useMutation({
    mutationFn: (vars: { id: number; force: boolean }) => deleteCard(vars.id, vars.force),
    onSuccess: () => { setConfirmDelete(null); setDeleteMsg(null); invalidate(); },
    onError: (e: unknown) => {
      if (e instanceof BizError && e.code === 4006) setDeleteMsg(e.message);
      else setDeleteMsg(getBizMessage(e, '删除失败'));
    },
  });

  const openCreate = () => { setEditing(null); setFormError(null); setShowModal(true); };
  const openEdit = (card: CardSummary) => { setEditing(card); setFormError(null); setShowModal(true); };
  const handleDelete = (card: CardSummary) => {
    setConfirmDelete(card); setDeleteMsg(null);
    deleteMut.mutate({ id: card.id, force: false });
  };
  const handleForceDelete = () => { if (confirmDelete) deleteMut.mutate({ id: confirmDelete.id, force: true }); };

  const { a: aCards, b: bCards } = partitionByLayer(cards ?? []);
  const empty = isKbEmpty(aCards, bCards);
  const total = aCards.length + bCards.length;

  return (
    <main className="mx-auto min-h-full max-w-[880px] px-5 py-8">
      {/* Header */}
      <header className="mb-5 flex items-baseline justify-between">
        <h1 className="font-serif text-title font-black text-paper-ink">
          知识库
          <span className="ml-2 font-sans text-copy font-normal text-paper-mutedLight">
            {total} 张卡片 · 活卡率 <span className="text-paper-mutedFaint">规划中</span>
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-panel bg-paper-primary px-5 py-2.5 text-body text-white transition hover:bg-paper-primaryHover"
          >
            + 新建卡片
          </button>
          <button
            type="button"
            disabled
            className="rounded-panel border border-paper-primary px-5 py-2.5 text-body text-paper-primary opacity-45 cursor-not-allowed"
          >
            + 对话补卡（规划中）
          </button>
        </div>
      </header>

      {isLoading && <p className="py-10 text-center text-body text-paper-muted">加载中…</p>}
      {error && (
        <p className="py-10 text-center text-body text-paper-danger">加载失败：{getBizMessage(error)}</p>
      )}

      {/* 空态互斥：A+B=0 只渲染 dashed 空态 */}
      {empty && !isLoading && !error && (
        <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-11 text-center">
          <p className="mb-2 font-serif text-[18px] font-black text-paper-ink">知识库还是空的</p>
          <p className="mb-5 text-body leading-loose text-paper-inkSoft">
            知识库是「稿子像你」的原料——完成定位校准会自动生成人设卡
            <br />
            之后 AI 每次只问你一个 30 秒的问题，卡片越攒越多
          </p>
          <div className="flex justify-center gap-2.5">
            <Link
              to="/calibrate"
              className="rounded-panel bg-paper-primary px-6 py-3 text-body text-white transition hover:bg-paper-primaryHover"
            >
              先完成定位校准
            </Link>
            <button
              type="button"
              disabled
              className="rounded-panel border border-paper-primary px-6 py-3 text-body text-paper-primary opacity-45 cursor-not-allowed"
            >
              直接回答一个问题建卡（规划中）
            </button>
          </div>
        </div>
      )}

      {/* 有数据：A 网格 + B 网格 + 缺卡位 + C stat */}
      {!empty && !isLoading && !error && (
        <>
          {/* A 层 */}
          <section className="mb-[26px]">
            <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">{EYEBROWS.A}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {aCards.map((card) => (
                <div
                  key={card.id}
                  className="flex flex-col rounded-panel border border-paper-line bg-paper-card px-[18px] py-4 transition hover:border-paper-primary"
                >
                  <div className="mb-1.5 text-body font-bold text-paper-ink">{card.title}</div>
                  <div className="flex-1 text-caption leading-snug text-paper-inkSoft line-clamp-2">
                    {displayContent(card.content)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(card)}
                      className="rounded-chip border border-paper-lineStrong px-3 py-1 text-meta text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(card)}
                      disabled={deleteMut.isPending}
                      className="rounded-chip border border-paper-lineStrong px-3 py-1 text-meta text-paper-inkSoft transition hover:border-paper-danger hover:text-paper-danger disabled:opacity-45"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* B 层 */}
          <section className="mb-[26px]">
            <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">{EYEBROWS.B}</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {bCards.map((card) => (
                <div
                  key={card.id}
                  className="flex flex-col rounded-panel border border-paper-line bg-paper-card px-[18px] py-4 transition hover:border-paper-primary"
                >
                  <div className="mb-1 text-hint font-bold text-paper-primary">
                    {card.cardType || '未分类'}
                  </div>
                  <div className="mb-1 text-body font-bold text-paper-ink">{card.title}</div>
                  <div className="flex-1 text-meta leading-normal text-paper-muted line-clamp-2">
                    {displayContent(card.content)}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(card)}
                      className="rounded-chip border border-paper-lineStrong px-3 py-1 text-meta text-paper-inkSoft transition hover:border-paper-primary hover:text-paper-primary"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(card)}
                      disabled={deleteMut.isPending}
                      className="rounded-chip border border-paper-lineStrong px-3 py-1 text-meta text-paper-inkSoft transition hover:border-paper-danger hover:text-paper-danger disabled:opacity-45"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 缺卡提醒位（disabled 规划中，B 与 C 之间） */}
          <div className="mb-[26px] flex items-center gap-3.5 rounded-panel border border-paper-dangerLine bg-paper-dangerTint px-[18px] py-3.5">
            <div className="flex-1 text-copy leading-relaxed text-paper-primaryDeep">
              <strong>缺卡提醒：</strong>规划中
            </div>
            <button
              type="button"
              disabled
              className="rounded-chip bg-paper-danger px-4 py-2 text-copy text-white opacity-45 cursor-not-allowed"
            >
              语音回答
            </button>
          </div>

          {/* C 层 stat 占位（disabled 规划中，移除 CRUD） */}
          <section>
            <div className="mb-2.5 text-meta font-bold tracking-wide text-paper-primary">
              C 层 · 内容资产（自动沉淀）
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {['历史稿件', '改稿记录', '表现数据'].map((t) => (
                <div
                  key={t}
                  className="rounded-panel border border-paper-line bg-paper-sunken px-[18px] py-4 opacity-60"
                >
                  <div className="mb-1 text-body font-bold text-paper-ink">{t}</div>
                  <div className="text-meta text-paper-muted">规划中</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {/* 新建/编辑弹窗（A/B） */}
      {showModal && (
        <CardModal
          editing={editing}
          pending={createMut.isPending || updateMut.isPending}
          error={formError}
          onClose={() => { setShowModal(false); setEditing(null); setFormError(null); }}
          onSubmit={(layer, cardType, title, content) => {
            if (editing) updateMut.mutate({ id: editing.id, title, content });
            else createMut.mutate({ layer, cardType, title, content });
          }}
        />
      )}

      {/* 删除二次确认（引用保护 4006） */}
      {confirmDelete && deleteMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-block border border-paper-line bg-paper-card p-6 shadow-modal">
            <h3 className="mb-2 font-serif text-[18px] font-bold text-paper-ink">删除确认</h3>
            <p className="mb-4 text-copy leading-relaxed text-paper-danger">{deleteMsg}</p>
            <p className="mb-5 text-meta text-paper-muted">
              强制删除后，引用此卡的稿件将无法追溯其来源。是否继续？
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setConfirmDelete(null); setDeleteMsg(null); }}
                className="rounded-card border border-paper-lineStrong bg-paper-card px-4 py-2 text-copy text-paper-primary transition hover:bg-paper-tint"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleForceDelete}
                disabled={deleteMut.isPending}
                className="rounded-card bg-paper-danger px-4 py-2 text-copy text-white transition hover:bg-paper-dangerHover disabled:opacity-45"
              >
                {deleteMut.isPending ? '删除中…' : '仍然删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** 新建/编辑弹窗。新建 A|B 二选一（默认 B）；编辑沿用卡自身 layer（只读，不切 C）。B 层提示重算向量。 */
function CardModal({
  editing,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  editing: CardSummary | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (layer: ABLayer, cardType: string, title: string, content: string) => void;
}) {
  const [layer, setLayer] = useState<ABLayer>(editing?.layer === 'A' ? 'A' : 'B');
  const [cardType, setCardType] = useState(editing?.cardType ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState(editing ? displayContent(editing.content) : '');

  const canSubmit = title.trim().length > 0 && content.trim().length > 0;
  const isBLayer = layer === 'B' || editing?.layer === 'B';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-lg rounded-block border border-paper-line bg-paper-card p-6 shadow-modal">
        <h3 className="mb-4 font-serif text-[18px] font-bold text-paper-ink">
          {editing ? '编辑卡片' : '新建卡片'}
        </h3>

        {error && (
          <div role="alert" className="mb-4 rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3 py-2 text-copy text-paper-danger">
            {error}
          </div>
        )}

        {/* 层选择：编辑只读，新建 A|B 二选一（默认 B） */}
        <div className="mb-4">
          <label className="mb-1.5 block text-hint font-semibold text-paper-muted">层</label>
          {editing ? (
            <div className="rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-inkSoft">
              {layer} 层
            </div>
          ) : (
            <div className="flex gap-2">
              {(['A', 'B'] as ABLayer[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  className={`rounded-card border px-4 py-2 text-copy ${
                    layer === l
                      ? 'border-paper-primary bg-paper-primary text-white'
                      : 'border-paper-lineStrong bg-paper-card text-paper-primary hover:bg-paper-tint'
                  }`}
                >
                  {l} 层
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-hint font-semibold text-paper-muted">卡片类型</label>
          <input
            type="text"
            placeholder="如：产品 / 人物 / 金句"
            value={cardType}
            onChange={(e) => setCardType(e.target.value)}
            className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-hint font-semibold text-paper-muted">标题</label>
          <input
            type="text"
            placeholder="卡片标题（100 字内）"
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-hint font-semibold text-paper-muted">内容</label>
          <textarea
            rows={5}
            placeholder="卡片内容（纯文本，保存时自动包装为 JSON）"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-2.5 text-body text-paper-ink outline-none focus:border-paper-primary"
          />
        </div>

        {isBLayer && (
          <p className="mb-4 rounded-card border border-paper-goldPale bg-paper-tint px-3 py-2 text-meta text-paper-primary">
            {LAYER_HINTS.B}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-card border border-paper-lineStrong bg-paper-card px-4 py-2 text-copy text-paper-primary transition hover:bg-paper-tint"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit || pending}
            onClick={() => onSubmit(layer, cardType.trim() || '未分类', title.trim(), wrapContent(content))}
            className="rounded-card bg-paper-primary px-4 py-2 text-copy text-white transition hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
