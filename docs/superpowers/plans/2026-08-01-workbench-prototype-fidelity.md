# 工作台原型对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/workbench` 从「余额卡 + 资料捷径脚手架」做成对齐原型 `sections/08-工作台.html` 的双态工作台，并达到 `PROTOTYPE_GAP.md` 令牌过线（B）。

**Architecture:** 用纯函数 `deriveHomeMode` 决定 `homeNew` vs `homeNormal`；页面组合已有 API（`/profile`、`/topics`、`/kb/cards`、`/scripts`），不新增后端。额度余额改由侧边栏展示，本页不再做大号余额卡与 ad-hoc 导航条。知识空白条无后端信号，本期不渲染（gap 备注延期）。

**Tech Stack:** React 18 + React Router 6 + TanStack Query 5 + Tailwind（`paper.*` / `text-title|lead|body|…`）+ Vitest（仅测纯函数）

## Global Constraints

- 尺子：`prototypes/PROTOTYPE_GAP.md` 令牌过线（B）——结构齐；色用 `paper.*`；字号用 `text-title/lead/body/copy/meta/hint/caption/sub`，**禁止**页面主体用 `text-2xl` / `text-sm` / `text-xs` / `text-5xl` 冒充；常见色禁止裸 hex（`#8a5a2b` 等已进令牌的值）
- 对照源：`prototypes/extracted/sections/08-工作台.html`
- 布局：页在 `AppLayout` 内，根节点用 `div.max-w-[880px].mx-auto`，**不要**再包一层带 `py-8` 的 `<main>`（外壳已 `px-10 py-8`）
- 退出登录：只保留侧边栏入口；工作台页删除「退出登录」按钮
- 不接新后端；不实现「知识空白提醒」条（无 API）
- 前置：工作区需有 `src/api/topic.ts`、`getActiveProfile`（`src/api/profile.ts`）。若未提交，本计划实施前先把它们落进分支

---

## File map

| 文件 | 职责 |
|---|---|
| `src/pages/workbench/homeMode.ts` | 纯函数：问候文案、双态判定、本周指标聚合 |
| `src/pages/workbench/homeMode.test.ts` | Vitest：上述纯函数 |
| `src/lib/topicSourceMeta.ts` | 选题来源标签文案/色（从 Topics 抽出，Workbench 复用） |
| `src/pages/workbench/HomeNew.tsx` | `homeNew`：三步开始卡 + 可选「额度未开通」条 |
| `src/pages/workbench/HomeNormal.tsx` | `homeNormal`：可选未校准条 + 三指标 + 今日选题 +（无知识空白） |
| `src/pages/Workbench.tsx` | 拉数、分支渲染、loading/error |
| `vitest.config.ts` / `package.json` | 测试脚本 |
| `prototypes/PROTOTYPE_GAP.md` | 工作台行改为过线 |

---

### Task 1: 双态纯函数 + Vitest

**Files:**
- Create: `src/pages/workbench/homeMode.ts`
- Create: `src/pages/workbench/homeMode.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`（加 `vitest` devDep + `"test": "vitest run"`）

**Interfaces:**
- Produces:
  - `export type HomeMode = 'new' | 'normal'`
  - `export function deriveHomeMode(calibrated: boolean): HomeMode` — `!calibrated` → `'new'`，否则 `'normal'`（与原型 `homeNew` / `homeNormal` 互斥；未校准走三步引导，已校准走常态）
  - `export function homeGreeting(nickname: string | null | undefined, now?: Date): string` — 有昵称：`{nickname}，{时段}好`；无昵称：`{时段}好`。时段：5–11 早上、11–14 中午、14–18 下午、其余 晚上（`now` 可注入便于测）
  - `export function homeSub(mode: HomeMode, balance: number): string` — `new`：`三步开始，把「像你」的底子打好 · 剩余额度 {n} 条`；`normal`：`今天也继续产出 · 剩余额度 {n} 条`
  - `export function weekStart(d: Date): Date` — 本地时区本周一 00:00:00
  - `export function countSince(isoDates: string[], since: Date): number`
  - `export function adoptRate(states: string[]): { pct: number; sample: number }` — `sample===0` → `{pct:0,sample:0}`；采用 = `reviewState` 属于 `pending|tracking|hot|plain|flop`（已采用闭环）；`draft|rejected` 不计采用。`pct` 为 0–100 整数

- [ ] **Step 1: 安装 Vitest 并写配置**

```bash
cd /Users/rick/work/sks-web && npm install -D vitest
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

`package.json` scripts 增加：`"test": "vitest run"`。

- [ ] **Step 2: 写失败测试**

`src/pages/workbench/homeMode.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  adoptRate,
  countSince,
  deriveHomeMode,
  homeGreeting,
  homeSub,
  weekStart,
} from './homeMode';

describe('deriveHomeMode', () => {
  it('未校准 → new', () => expect(deriveHomeMode(false)).toBe('new'));
  it('已校准 → normal', () => expect(deriveHomeMode(true)).toBe('normal'));
});

describe('homeGreeting', () => {
  it('早上带昵称', () => {
    expect(homeGreeting('王姐', new Date('2026-08-01T08:00:00'))).toBe('王姐，早上好');
  });
  it('无昵称晚上', () => {
    expect(homeGreeting(null, new Date('2026-08-01T20:00:00'))).toBe('晚上好');
  });
});

describe('homeSub', () => {
  it('new 文案含额度', () => {
    expect(homeSub('new', 10)).toContain('10');
    expect(homeSub('new', 10)).toContain('三步开始');
  });
});

describe('adoptRate', () => {
  it('空样本', () => expect(adoptRate([])).toEqual({ pct: 0, sample: 0 }));
  it('2/4 采用', () => {
    expect(adoptRate(['draft', 'pending', 'hot', 'rejected'])).toEqual({ pct: 50, sample: 4 });
  });
});

describe('countSince', () => {
  it('只计 since 之后', () => {
    const since = new Date('2026-07-28T00:00:00');
    expect(
      countSince(['2026-07-27T12:00:00', '2026-07-29T12:00:00'], since),
    ).toBe(1);
  });
});
```

- [ ] **Step 3: 跑测确认失败**

Run: `cd /Users/rick/work/sks-web && npm test -- src/pages/workbench/homeMode.test.ts`
Expected: FAIL（模块不存在或导出缺失）

- [ ] **Step 4: 实现 `homeMode.ts`**

```ts
export type HomeMode = 'new' | 'normal';

export function deriveHomeMode(calibrated: boolean): HomeMode {
  return calibrated ? 'normal' : 'new';
}

export function homeGreeting(nickname: string | null | undefined, now = new Date()): string {
  const h = now.getHours();
  const slot = h >= 5 && h < 11 ? '早上' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上';
  const name = nickname?.trim();
  return name ? `${name}，${slot}好` : `${slot}好`;
}

export function homeSub(mode: HomeMode, balance: number): string {
  if (mode === 'new') {
    return `三步开始，把「像你」的底子打好 · 剩余额度 ${balance} 条`;
  }
  return `今天也继续产出 · 剩余额度 ${balance} 条`;
}

export function weekStart(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + diff);
  return x;
}

export function countSince(isoDates: string[], since: Date): number {
  const t = since.getTime();
  return isoDates.filter((s) => {
    const ms = Date.parse(s);
    return !Number.isNaN(ms) && ms >= t;
  }).length;
}

const ADOPTED = new Set(['pending', 'tracking', 'hot', 'plain', 'flop']);

export function adoptRate(states: string[]): { pct: number; sample: number } {
  const sample = states.length;
  if (sample === 0) return { pct: 0, sample: 0 };
  const hit = states.filter((s) => ADOPTED.has(s)).length;
  return { pct: Math.round((hit / sample) * 100), sample };
}
```

- [ ] **Step 5: 跑测确认通过**

Run: `npm test -- src/pages/workbench/homeMode.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/rick/work/sks-web
git add package.json package-lock.json vitest.config.ts \
  src/pages/workbench/homeMode.ts src/pages/workbench/homeMode.test.ts
git commit -m "$(cat <<'EOF'
feat(web): 工作台双态纯函数 + vitest

为 /workbench 原型对齐抽出 homeNew/homeNormal 判定、问候语与周指标聚合，
并用 vitest 锁行为；不新增后端。
EOF
)"
```

---

### Task 2: 抽出选题来源标签元数据

**Files:**
- Create: `src/lib/topicSourceMeta.ts`
- Modify: `src/pages/Topics.tsx`（改为从 lib import，删除本地 `SOURCE_META`）

**Interfaces:**
- Consumes: 无
- Produces:
  - `export function topicSourceMeta(source: string): { label: string; cls: string }`
  - 映射与现 Topics 一致：`hot`→每日热点（`border-paper-goldPale bg-paper-tint text-paper-primary`）；`faq`→你的 FAQ；`benchmark`→对标拆解；`replay`→爆款复盘；默认未分类

- [ ] **Step 1: 创建 `topicSourceMeta.ts`（内容从当前 `Topics.tsx` 原样搬出）**

```ts
/** 选题四路来源标签。原型 tag 色是模板变量未持久化，按 paper 语义色分配（与 Topics 页一致）。 */
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  hot: { label: '每日热点', cls: 'border-paper-goldPale bg-paper-tint text-paper-primary' },
  faq: { label: '你的 FAQ', cls: 'border-paper-goldSoft bg-paper-sunken text-paper-gold' },
  benchmark: { label: '对标拆解', cls: 'border-paper-lineStrong bg-paper-sunken text-paper-info' },
  replay: { label: '爆款复盘', cls: 'border-paper-lineStrong bg-paper-successTint text-paper-success' },
};

export function topicSourceMeta(source: string): { label: string; cls: string } {
  return (
    SOURCE_META[source] ?? {
      label: source || '未分类',
      cls: 'border-paper-line bg-paper-sunken text-paper-muted',
    }
  );
}
```

- [ ] **Step 2: 改 `Topics.tsx` 使用 `topicSourceMeta`，删除本地 `SOURCE_META` / `sourceMeta`**

- [ ] **Step 3: `npm run build` 确认通过**

Expected: Vite build success，无 TS 错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/topicSourceMeta.ts src/pages/Topics.tsx
git commit -m "refactor(web): 抽出 topicSourceMeta 供工作台与选题库共用"
```

---

### Task 3: `HomeNew` 三步引导 UI

**Files:**
- Create: `src/pages/workbench/HomeNew.tsx`

**Interfaces:**
- Consumes: 无（纯展示 + `Link`）
- Produces: `export default function HomeNew(props: { balance: number }): JSX.Element`
- 行为：
  - 三步卡文案**逐字**取自 `08-工作台.html`（校准 / 拆对标 / 生成文案）
  - 链接：`/positioning`、`/analyze`、`/create`（注意：校准入口原型写 goPos→账号定位，不是 `/calibrate`）
  - 当 `balance === 0` 时显示「额度未开通」危险条；按钮 `type="button"`，`onClick` 用 `window.alert('请联系站长微信开通额度（备注手机尾号）')`（无充值 API，YAGNI）
  - 令牌：`rounded-block`/`rounded-panel`、`border-paper-*`、`text-meta`/`text-lead`/`text-copy`/`font-serif text-[18px]`，禁止默认字号阶与裸 hex

- [ ] **Step 1: 实现 `HomeNew.tsx`**

结构草图（实现时写全 class，对齐原型间距）：

```tsx
import { Link } from 'react-router-dom';

const STEPS = [
  {
    to: '/positioning',
    step: '第 1 步 · 约 15 分钟',
    title: '校准账号定位',
    desc: '贴个链接聊几句，生成你的定位档案',
    emphasize: true, // 金边 tint 底
  },
  {
    to: '/analyze',
    step: '第 2 步 · 约 5 分钟',
    title: '拆一个对标账号',
    desc: 'TOP20 爆款全拆解，选题库立刻有货',
    emphasize: false,
  },
  {
    to: '/create',
    step: '第 3 步 · 约 1 分钟',
    title: '生成第一条文案',
    desc: '挑个选题一键生成，不满意免费换角度',
    emphasize: false,
  },
] as const;

export default function HomeNew({ balance }: { balance: number }) {
  return (
    <>
      <section className="mb-5 rounded-block border border-paper-line bg-paper-card px-8 py-[30px]">
        <h2 className="mb-1.5 font-serif text-[18px] font-black">三步开始，第一条文案 10 分钟内到手</h2>
        <p className="mb-[18px] text-copy text-paper-muted">按顺序完成，每一步都直接提升「稿子像不像你」</p>
        <div className="grid grid-cols-3 gap-3">
          {STEPS.map((s) => (
            <Link
              key={s.to}
              to={s.to}
              className={
                s.emphasize
                  ? 'rounded-panel border border-paper-goldPale bg-paper-tint px-[18px] py-4 hover:border-paper-primary'
                  : 'rounded-panel border border-paper-line bg-paper-sunken px-[18px] py-4 hover:border-paper-primary'
              }
            >
              <div className="mb-1.5 text-meta font-bold text-paper-primary">{s.step}</div>
              <div className="mb-1 text-lead font-bold text-paper-ink">{s.title}</div>
              <div className="text-meta leading-normal text-paper-inkSoft">{s.desc}</div>
            </Link>
          ))}
        </div>
      </section>
      {balance === 0 && (
        <div className="flex items-center gap-3.5 rounded-panel border border-paper-dangerLine bg-paper-dangerTint px-[18px] py-3.5">
          <p className="flex-1 text-copy leading-normal text-paper-primaryDeep">
            <strong>额度未开通</strong> · 加微信备注手机尾号，10 分钟内开通并送 10 条体验额度
          </p>
          <button
            type="button"
            className="whitespace-nowrap rounded-chip bg-paper-danger px-4 py-2 text-copy text-white hover:bg-paper-dangerHover"
            onClick={() => window.alert('请联系站长微信开通额度（备注手机尾号）')}
          >
            查看二维码
          </button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: 自检令牌**

Run: `rg -n 'text-2xl|text-sm|text-xs|text-5xl|text-base|#[0-9a-fA-F]{3,8}' src/pages/workbench/HomeNew.tsx`
Expected: 无匹配（`text-[18px]` 允许——原型 18px 标题频次不足单独令牌）

- [ ] **Step 3: Commit**

```bash
git add src/pages/workbench/HomeNew.tsx
git commit -m "feat(web): 工作台 homeNew 三步引导（令牌对齐原型）"
```

---

### Task 4: `HomeNormal` 指标 + 今日选题

**Files:**
- Create: `src/pages/workbench/HomeNormal.tsx`

**Interfaces:**
- Consumes: `topicSourceMeta`；`Topic` from `../api/topic`；`ScriptSummary` from `../api/script`（或 review——以 `listScripts` 实际导出为准，优先 `src/api/script.ts`）
- Produces: `export default function HomeNormal(props: HomeNormalProps)`

```ts
export interface HomeNormalProps {
  cardCount: number;
  cardsUpdatedThisWeek: number;
  scriptsThisWeek: number;
  adoptPct: number;
  adoptSample: number; // 0 → UI 显示「—」而非 0%
  topics: {
    id: number;
    source: string;
    title: string;
    rationale: string | null;
    pillar: string | null;
    status: string;
  }[];
}
```

- 行为：
  - 三指标卡：知识库卡片（总数 + 若 `cardsUpdatedThisWeek>0` 显示 `+N 本周` 用 `text-paper-success`）；本周生成文案；文案采用率（`adoptSample===0` 显示 `—`，否则 `{adoptPct}%`）
  - 「今日选题建议」：取 `topics` 里 `status==='open'` 的前 3 条；0 条显示虚线空态「选题库还是空的」+ `Link` 到 `/topics`
  - 每条：`topicSourceMeta` 标签 + 标题 + rationale/pillar +「生成文案」→ `/create?topic={id}`
  - **不渲染**知识空白条；**不接收** `calibrated`（双态已在父组件互斥）

- [ ] **Step 1: 实现 `HomeNormal.tsx`（令牌约束同 Task 3）**

指标数字用 `font-serif text-title font-bold`（26px）。采用率旁不造假「↑12%」（无环比 API）。

- [ ] **Step 2: 令牌自检**

Run: `rg -n 'text-2xl|text-sm|text-xs|text-5xl|#[0-9a-fA-F]{3,8}' src/pages/workbench/HomeNormal.tsx`
Expected: 无匹配

- [ ] **Step 3: Commit**

```bash
git add src/pages/workbench/HomeNormal.tsx
git commit -m "feat(web): 工作台 homeNormal 指标卡与今日选题"
```

---

### Task 5: 重写 `Workbench.tsx` 接线 + 更新 gap

**Files:**
- Modify: `src/pages/Workbench.tsx`（整文件替换为接线壳）
- Modify: `prototypes/PROTOTYPE_GAP.md`（工作台行：令牌过、功能过；建议序 `—`；证据改写；backlog 第 1 条划掉或标完成）

**Interfaces:**
- Consumes: `fetchMe`、`getActiveProfile`、`listTopics`、`listCards`、`listScripts`（`script.ts`）、`deriveHomeMode` / `homeGreeting` / `homeSub` / `weekStart` / `countSince` / `adoptRate`、`HomeNew`、`HomeNormal`

- [ ] **Step 1: 重写 `Workbench.tsx`**

要点：

```tsx
// 伪代码结构——实现时写全
const meQ = useQuery({ queryKey: ['me'], queryFn: fetchMe });
const profileQ = useQuery({ queryKey: ['profile'], queryFn: getActiveProfile });
const topicsQ = useQuery({ queryKey: ['topics'], queryFn: () => listTopics() });
const cardsQ = useQuery({ queryKey: ['kb-cards'], queryFn: () => listCards() });
const scriptsQ = useQuery({ queryKey: ['scripts'], queryFn: () => listScripts() });

const loading = meQ.isLoading || profileQ.isLoading;
const error = meQ.error || profileQ.error;
// topics/cards/scripts 失败时降级为空数组，不整页打爆

const mode = deriveHomeMode(profileQ.data?.calibrated ?? false);
const since = weekStart(new Date());
// cards: countSince(cards.map(c => c.updatedAt), since)
// scriptsThisWeek: countSince(scripts.map(s => s.createdAt), since)
// adopt: const { pct, sample } = adoptRate(scripts.map(s => s.reviewState))
// HomeNormal: adoptPct={pct} adoptSample={sample}
```

Loading / error UI 也必须令牌化（`text-paper-danger` 等，禁止裸 `#b0492f`）。

根结构：

```tsx
<div className="mx-auto max-w-[880px]">
  <h1 className="mb-1 font-serif text-title font-black">{homeGreeting(...)}</h1>
  <p className="mb-[26px] text-lead text-paper-muted">{homeSub(...)}</p>
  {mode === 'new' ? <HomeNew balance={...} /> : <HomeNormal ... />}
</div>
```

删除：大号余额卡、个人资料 dl、ad-hoc 五链接、退出按钮。

- [ ] **Step 2: `npm test` && `npm run build`**

Expected: 全绿

- [ ] **Step 3: 手动验收清单（浏览器登录后打开 `/workbench`）**

1. 未校准用户：见「三步开始」三卡，点第 1 步进 `/positioning`
2. 已校准用户：见三指标 + 今日选题（有 open 选题时最多 3 条，「生成文案」带 `?topic=`）
3. 侧边栏仍显示额度；本页无「退出登录」
4. DevTools 粗看：标题为 serif 26px 量级，无巨大余额数字

- [ ] **Step 4: 更新 `PROTOTYPE_GAP.md`**

工作台行改为：骨架过 / 令牌过 / 功能过；证据写「双态 homeNew/homeNormal；指标由 cards/scripts 聚合；知识空白条无 API 未做（接受）」；建议序 `—`。  
backlog 第 1 条改为删除或 `~~工作台~~ 完成`。

- [ ] **Step 5: Commit**

```bash
git add src/pages/Workbench.tsx prototypes/PROTOTYPE_GAP.md
git commit -m "$(cat <<'EOF'
feat(web): 工作台对齐原型双态并令牌过线

替换余额卡脚手架为 homeNew/homeNormal；聚合已有 profile/topics/kb/scripts。
知识空白条无后端信号本期不做。更新 PROTOTYPE_GAP 工作台行。
EOF
)"
```

---

## 本计划不包含（后续单独开 plan）

建议序 2–8：文案创作、对标拆解、知识库、发布复盘、校准对话、侧栏演示开关、账号定位对话回放。

---

## Self-review（写作时已执行）

1. **Spec coverage：** Gap 工作台「双态 + 令牌」→ Task 1–5；「知识空白」明确延期。  
2. **Placeholder scan：** 无 TBD；充值用 alert 写死文案。  
3. **Type consistency：** `HomeMode`、`HomeNormalProps`、`topicSourceMeta` 前后一致；`listScripts` 指定 `script.ts`。  
4. **Scope：** 仅工作台一切片，可独立交付。
