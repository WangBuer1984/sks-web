# 知识库页对齐原型 (D3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `KB.tsx`(`/kb`) 从「tab + text-2xl/sm + 裸 hex + 无补卡/缺卡」重塑为原型 `15-知识库.html`：A/B/C 三层三列网格（全可见，去 tab）+ 令牌化 + deferred 诚实占位（对话补卡/缺卡/活卡率/C stat disabled「规划中」）。

**Architecture:** 单仓 sks-web，纯前端，无后端改动。抽 `displayContent`/`wrapContent` 到 `lib/kbText.ts`、`partitionByLayer`/`isKbEmpty` 到 `kbMode.ts`（纯函数测）；KB.tsx 全量重塑。保留 CardModal（A/B 新建编辑）+ 删除引用保护 4006。C 层 CRUD 移除（方向 C=auto-沉淀 stat 占位）。

**Tech Stack:** React 18 + Vite + TS + TanStack Query + Tailwind。

## Global Constraints

- **纸感色板 + 令牌**：`#f4f1e9`/`#8a5a2b`/`Noto Serif SC`；主体不得 `text-2xl/sm/xs` 冒充、不得裸 hex（频次<3 局部值例外须注明）。
- **单仓、不改后端契约**：`listCards()` 无 layer 已支持取全量，不改 `api/kb.ts` / sks-server / sks-ai。
- **deferred 诚实占位**：对话补卡/缺卡提醒/活卡率/C stat = disabled「规划中」，不造假数据、不接不存在的 API。
- **C 层 CRUD 移除**：不取/不渲染/不新建 C 卡；库里已有 C 卡 UI 不展示（卡仍在库）。
- **Header CTA 差异（非缺陷）**：working 创建入口用「+ 新建卡片」（API 支持）；「+ 对话补卡」disabled 占位贴原型。验收不得以「主按钮不像原型」判偏。
- **空态互斥**：`isKbEmpty(a,b)`（A.length+B.length===0，忽略 C）→ 只渲染 dashed 空态，不叠空 A/B 网格 + C。
- **去 tab 后无 active layer**：新建用 Modal 内 A|B 二选一（默认 B），编辑沿用卡自身 layer，不依赖 tab 状态。
- **`max-w-[880px]`**（原型 880px）；网格 `grid-cols-1 md:grid-cols-3`；queryKey `['kb-cards']`（去按-layer）。
- **测试**：vitest `environment:'node'`、`include:['src/**/*.test.ts']`、无 jsdom——纯函数单测（照 homeMode.ts）。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `src/lib/kbText.ts` (Create) | `displayContent`/`wrapContent` 纯函数（从 KB.tsx 抽出，DRY + 可测） |
| `src/lib/kbText.test.ts` (Create) | displayContent/wrapContent 测 |
| `src/pages/kbMode.ts` (Create) | `partitionByLayer`/`isKbEmpty` 纯函数 |
| `src/pages/kbMode.test.ts` (Create) | partitionByLayer/isKbEmpty 测 |
| `src/pages/KB.tsx` (Modify) | 全量重塑：去 tab + 三层三列网格 + deferred 占位 + 空态互斥 + 令牌化 |
| `prototypes/PROTOTYPE_GAP.md` (Modify) | 行 15 过线 + backlog 4 划完成 |

---

## Task 1: 抽纯函数（kbText + kbMode）+ 测

**Files:**
- Create: `/Users/rick/work/sks-web/src/lib/kbText.ts`
- Create: `/Users/rick/work/sks-web/src/lib/kbText.test.ts`
- Create: `/Users/rick/work/sks-web/src/pages/kbMode.ts`
- Create: `/Users/rick/work/sks-web/src/pages/kbMode.test.ts`

**Interfaces:**
- Produces: `kbText.ts` 导出 `displayContent(raw: string): string`、`wrapContent(text: string): string`；`kbMode.ts` 导出 `partitionByLayer(cards: CardSummary[]): {a: CardSummary[]; b: CardSummary[]}`、`isKbEmpty(a, b): boolean`。

- [ ] **Step 1: 写失败测试** — `src/lib/kbText.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { displayContent, wrapContent } from './kbText';

describe('displayContent', () => {
  it('JSON 字符串 → 原文', () =>
    expect(displayContent(JSON.stringify('说真话的工厂人'))).toBe('说真话的工厂人'));
  it('JSON 对象 → pretty', () => {
    const raw = JSON.stringify({ k: 'v', n: 2 });
    expect(displayContent(raw)).toBe(JSON.stringify({ k: 'v', n: 2 }, null, 2));
  });
  it('非 JSON → 原文', () => expect(displayContent('纯文本')).toBe('纯文本'));
  it('空 → 空', () => expect(displayContent('')).toBe(''));
});

describe('wrapContent', () => {
  it('文本 → JSON 字符串', () =>
    expect(wrapContent('hi')).toBe(JSON.stringify('hi')));
  it('解析回原文一致', () => {
    const text = '一行内容';
    expect(displayContent(wrapContent(text))).toBe(text);
  });
});
```

`src/pages/kbMode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isKbEmpty, partitionByLayer } from './kbMode';
import type { CardSummary } from '../api/kb';

const card = (layer: string, id: number): CardSummary =>
  ({ id, layer, cardType: 't', title: `c${id}`, content: '"x"', updatedAt: '2026-08-04T00:00:00Z' });

describe('partitionByLayer', () => {
  it('按 A/B 分组，丢弃 C', () => {
    const { a, b } = partitionByLayer([card('A', 1), card('B', 2), card('C', 3), card('A', 4)]);
    expect(a.map(c => c.id)).toEqual([1, 4]);
    expect(b.map(c => c.id)).toEqual([2]);
  });
  it('空数组 → {a:[],b:[]}', () =>
    expect(partitionByLayer([])).toEqual({ a: [], b: [] }));
});

describe('isKbEmpty', () => {
  it('A+B=0 → true', () => expect(isKbEmpty([], [])).toBe(true));
  it('A 非空 → false', () => expect(isKbEmpty([card('A', 1)], [])).toBe(false));
  it('仅有 C 不算（调用方已 partition，但保险）', () => expect(isKbEmpty([], [])).toBe(true));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/lib/kbText.test.ts src/pages/kbMode.test.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写 `src/lib/kbText.ts`**

```ts
/** 后端 JSONB content（JSON 文本）→ 可读文本；非字符串 JSON 反序列化后 pretty-print；非 JSON 原样。 */
export function displayContent(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

/** 把 textarea 文本包装成合法 JSON 字符串存 JSONB（纯文本也能存）。 */
export function wrapContent(text: string): string {
  return JSON.stringify(text);
}
```

- [ ] **Step 4: 写 `src/pages/kbMode.ts`**

```ts
import type { CardSummary } from '../api/kb';

/** 按 layer 分 A/B 两组（丢弃 C——C 层 stat 占位，不取 CRUD 卡）。 */
export function partitionByLayer(cards: CardSummary[]): { a: CardSummary[]; b: CardSummary[] } {
  const a: CardSummary[] = [];
  const b: CardSummary[] = [];
  for (const c of cards) {
    if (c.layer === 'A') a.push(c);
    else if (c.layer === 'B') b.push(c);
  }
  return { a, b };
}

/** 空态判定：A+B=0（忽略 C）。仅有历史 C 卡仍走空态。 */
export function isKbEmpty(a: CardSummary[], b: CardSummary[]): boolean {
  return a.length + b.length === 0;
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd /Users/rick/work/sks-web && npx vitest run src/lib/kbText.test.ts src/pages/kbMode.test.ts`
Expected: 全 PASS。

- [ ] **Step 6: 提交**

```bash
cd /Users/rick/work/sks-web
git add src/lib/kbText.ts src/lib/kbText.test.ts src/pages/kbMode.ts src/pages/kbMode.test.ts
git commit -m "refactor(kb): 抽 kbText( displayContent/wrapContent) + kbMode( partitionByLayer/isKbEmpty) 纯函数

从 KB.tsx 抽 displayContent/wrapContent 到 lib/kbText（DRY+可测）；
新增 partitionByLayer(丢弃 C)/isKbEmpty(A+B=0) 为重塑准备。"
```

---

## Task 2: KB.tsx 全量重塑

**Files:**
- Modify: `/Users/rick/work/sks-web/src/pages/KB.tsx`（全量重写）

**Interfaces:**
- Consumes: `listCards()`(无 layer)、`createCard/updateCard/deleteCard`、`displayContent/wrapContent`(lib/kbText)、`partitionByLayer/isKbEmpty`(kbMode)、CardSummary/CardLayer。
- Produces: 重塑后的 `KB.tsx`（三层三列网格 + deferred 占位 + 空态互斥 + CardModal A/B）。

- [ ] **Step 1: 全量重写 `src/pages/KB.tsx`**

```tsx
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

  const { aCards, bCards } = partitionByLayer(cards ?? []);
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
```

> 删除了旧 `LAYER_LABELS`（A/B/C 三层 tab 用）+ `displayContent`/`wrapContent`（已抽到 lib/kbText）+ tab 状态。`CardModal` 不再从 props 收 `layer`，内部自管（新建 A|B 选、编辑沿用）。`CardLayer` import 保留（createCard 入参用）。

- [ ] **Step 2: 跑全量测 + 构建**

Run: `cd /Users/rick/work/sks-web && npm test && npm run build`
Expected: 全测 PASS（含 Task 1 的 kbText/kbMode 测）；build 无 TS/Tailwind 报错。注意 `line-clamp-2` 是 Tailwind 内置（v3+），无需插件。

- [ ] **Step 3: 提交**

```bash
cd /Users/rick/work/sks-web
git add src/pages/KB.tsx
git commit -m "refactor(kb): 去tab改三层三列网格 + 令牌化 + deferred 占位

照原型 15-知识库.html 重塑 KB.tsx：A/B 三列网格全可见、缺卡提醒位 + C 层 stat
占位（规划中，移除 C CRUD）、dashed 空态互斥（A+B=0）；保留 CardModal A/B
+ 引用保护删除。max-w-[880px]，queryKey ['kb-cards']。"
```

> 注意：sks-web 工作树可能有用户未提交 WIP（PROTOTYPE_GAP / analyze / topic / Review / Topics）。`git add` 只 add `src/pages/KB.tsx`；**不要 `git add -A`**。

---

## Task 3: PROTOTYPE_GAP.md 行 15 更新 + 验收

**Files:**
- Modify: `/Users/rick/work/sks-web/prototypes/PROTOTYPE_GAP.md`

- [ ] **Step 1: 改矩阵行 15** — 令牌不过→过、功能偏→过，证据改写、建议序 `4`→`—`。

原行：
```
| 15 | 知识库 | `isKb` | `KB.tsx` `/kb` | 过 | 不过 | 偏 | 令牌：`text-2xl/sm/xs` + 裸 hex。功能：A/B/C tab CRUD + 引用保护有；非原型分层三列网格，无「+对话补卡」/缺卡提醒等 | **4** |
```

改为：
```
| 15 | 知识库 | `isKb` | `KB.tsx` `/kb` | 过 | 过 | 过 | 令牌过线（text-title/body/copy/meta/hint + paper.*，max-w-[880px]，无 text-2xl/sm/xs 冒充、无裸 hex）。功能：去 tab 改 A/B 三层三列网格全可见 + 引用保护删除 + CardModal A/B；对话补卡/缺卡提醒/活卡率/C 层 stat deferred disabled 占位「规划中」（无 API）；C 层 CRUD 移除（方向 C=auto-沉淀） | — |
```

- [ ] **Step 2: 改 backlog 序 4** — 划完成：

```
4. ~~**知识库** — 令牌化 + 分层网格 / 补卡提醒（能接 API 的先接）~~ ✅ 完成（去 tab 改三层三列网格 + 令牌化；补卡/缺卡/活卡率/C stat 无 API deferred 占位；C 层 CRUD 移除）
```

- [ ] **Step 3: 提交 + 验收**

```bash
cd /Users/rick/work/sks-web
git add prototypes/PROTOTYPE_GAP.md
git commit -m "docs: PROTOTYPE_GAP 行 15 知识库过线"
```

验收口径复核：骨架路由可达 ✓；令牌过（grep KB.tsx 无 text-2xl/sm/xs + 裸 hex）✓；功能过（三层三列网格 CRUD + deferred 占位 + C 层方向）✓；`npm test && npm run build` 绿。

> 注意：PROTOTYPE_GAP.md 工作树可能有用户 WIP（rows 12/14 + backlog 3）。surgical-staged 只 add 行 15 + backlog 4（HEAD-baselined patch），不动 WIP。`git show --stat HEAD` 须只 1 文件、`git show HEAD` 须只行 15 + backlog 4。

---

## Self-Review

**1. Spec coverage:**
- §3 令牌迁移表 → Task 2 全量重写 ✓
- §4 结构（三层网格、header、A/B、缺卡位 B与C之间、C stat、empty 互斥）→ Task 2 ✓
- §4.1 Header CTA 差异（新建 working / 对话补卡 disabled）→ Task 2 ✓
- §4.3 B 字段映射 tag→cardType / meta→displayContent+line-clamp-2 → Task 2 ✓
- §4.6 empty = A+B=0 忽略 C → Task 1 isKbEmpty + Task 2 互斥渲染 ✓
- §5 CardModal 仅 A/B、编辑沿用自身 layer、不依赖 tab → Task 2 CardModal ✓
- §3 max-w-[880px] + §4 响应式 grid-cols-1 md:grid-cols-3 → Task 2 ✓
- §4 queryKey ['kb-cards'] → Task 2 ✓
- §8 测试（kbText + kbMode 纯函数）→ Task 1 ✓
- §10 验收 + PROTOTYPE_GAP 行 15 → Task 3 ✓

**2. Placeholder scan:** 无 TBD/TODO/「适当处理」。所有代码步骤含真实代码。✓

**3. Type consistency:**
- `displayContent`/`wrapContent` 在 lib/kbText.ts，KB + kbText.test 同 import ✓
- `partitionByLayer`/`isKbEmpty` 在 kbMode.ts，KB + kbMode.test 同 import ✓
- `ABLayer = 'A'|'B'`（KB.tsx 本地），CardModal 用；createCard 入参 `CardLayer`（含 C，但 Modal 只传 A/B）✓
- 用户 checklist：去 tab 后 Modal 内 A|B 选层默认 B（Task 2 CardModal `useState<ABLayer>(editing?.layer==='A'?'A':'B')`）✓；空态互斥不叠空网格（Task 2 `empty && ...` else `!empty && ...` 二选一）✓；partitionByLayer/isKbEmpty 抽出（Task 1）✓。
