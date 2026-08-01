# 文案创作 Create 原型对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `/create` 从「选题库 picker + 三段进度 + 逐句编辑」脚手架对齐到原型 `sections/13-文案创作.html` 的结构（自由 textarea + 时长芯片 + 三平台 Tab + 查重/采纳/换个角度/复制 + 引用侧栏），并达到 `PROTOTYPE_GAP.md` 令牌过线（B）。方向 = **B 混合**：原型展示块都补、后端真 API 功能（逐句编辑/换个说法、引用卡片、历史稿件）不砍。

**Architecture:** 把 551 行单文件 `Create.tsx` 拆成聚焦子组件（`CreateInput` / `CreateProgress` / `SectionEditor` / `ScriptView` / `CreateAside`）+ `Create.tsx` 编排壳。输入改原型自由 textarea（→ `createTopic` → `generateScript(topicId, platform)`）；产出加三平台 Tab（切换 = 按平台重生）；逐句编辑/换个说法保留并令牌化。不新增后端。

**Tech Stack:** React 18 + React Router 6 + TanStack Query 5 + Tailwind（`paper.*` / `text-title|lead|body|copy|meta|hint|caption|sub` / `rounded-block|panel|card|chip|tag|badge|soft`）+ Vitest（本计划无可测纯函数，验证靠 build + 令牌自检 grep + 手动验收）

## Global Constraints

- **尺子**：`prototypes/PROTOTYPE_GAP.md` 令牌过线（B）。**禁止**主体用 `text-2xl` / `text-sm` / `text-xs` / `text-5xl` / `text-base` 冒充；**禁止**裸 hex（`#d8c9b2` / `#fdf3e4` / `#6e4620` / `#e4b9ab` / `#faf0ec` / `#b0492f` / `#d8d2c4` / `#fdfcf8` / `#ecd4ae` / `#a8712e` 等现全页遍布——全换 `paper.*`）。令牌映射见下「Token Map」。
- **对照源**：`prototypes/extracted/sections/13-文案创作.html`（逐字逐样）。
- **布局**：页在 `AppLayout` 内，根 `div.max-w-[1040px].mx-auto`（原型 1040px），**不要**再包 `<main py-8>`（外壳已 `px-10 py-8`）。
- **B 混合的关键决策（实现时遵循，review 可推翻）**：
  1. **输入**：原型自由 textarea **替换**现有选题库 picker（picker 属 `/topics` 选题库页，不在此）。textarea 输入 → `createTopic(title)` 拿 `topicId` → `generateScript(topicId, platform)`。`CreateTopicButton` 弹窗删除。
  2. **时长芯片**（45秒/90秒/3分钟）：**真传后端、后端按时长生成**（非 display-only）。`generateScript(topicId, platform, duration)` 传 `duration: '45'|'90'|'180'` → sks-server 透传 → sks-ai 进 system prompt「目标时长: 45秒口播/90秒/3分钟深度」。跨仓改动见 **Task 0**。45秒默认选中（对齐原型）。
  3. **三平台 Tab**（抖音/小红书/视频号）：切换 Tab → `generateScript(topicId, platform)` 重生（原型「切换时生成」）。`generateScript` 已支持 `platform?` 入参。
  4. **查重提醒条**：后端**有** `dedupWarnScriptId`（`ScriptController.ScriptDetail` record 已带、生成命中则非空、不阻断，`DedupChecker` SimHash）。前端 `ScriptDetail` interface 现缺该字段 → **补**：加 `dedupWarnScriptId: number | null`，ScriptView 命中时显黄条「相似度高于阈值，已/可换角度」+「换个角度」按钮（→ onRegenerate）。不造假数据。
  5. **正文内联下划线引用**（原型 `<span title="来源：XX卡">`）：后端只给 `citedCardIds`（卡 ID 列表），无内联位置 → **不做内联下划线**，保留右栏引用卡列表（现有真功能）。
  6. **逐句编辑/换个说法**：**保留**（`editSentence`/`rewriteSentence` 真 API、PRD 硬功能），令牌化，嵌在活动平台 Tab 的稿件视图里。
  7. **genLoading**：对齐原型**单行 pulse**「①检索知识库→②撰写→③安全审核·约30-60秒」（替换现有三段 `<ol>` 进度列表）。若 review 想保留三段进度，改本条。
  8. **采纳/换个角度/复制全文**：采纳 → `navigate('/review')`（去发布复盘登记链接，原型 `openPubFromCreate`）；换个角度 → `genMut.mutate({topicId, platform})` 重生；复制全文 → `navigator.clipboard.writeText` 拼 hook/body/cta。
  9. **历史稿件**：**保留**（B 不砍真功能），放右栏引用卡下方。
  10. **genIdle 空态**：对齐原型虚线框「输入选题后点击「生成口播稿」…」。
- **不接新后端**；不实现查重/内联引用（无 API）。
- **前置**：`src/api/script.ts` 的 `createTopic`/`generateScript(topicId, platform?)`/`editSentence`/`rewriteSentence`/`parseSection` 均已存在（已核实）。

---

## Token Map（机械替换表，执行时全页套用）

| 现有（违禁） | 换成 |
|---|---|
| `text-2xl` | `text-title`（26px） |
| `text-base` | `text-lead`（14px）或 `text-body`（13.5px），按语境 |
| `text-sm` | `text-body`（13.5px）或 `text-copy`（13px）或 `text-caption`（12.5px），按语境 |
| `text-xs` | `text-meta`（12px）或 `text-hint`（11px） |
| `text-[11.5px]` / `text-[11px]` / `text-[12px]` / `text-[12.5px]` / `text-[13px]` / `text-[13.5px]` / `text-[14.5px]` / `text-[15px]` | 用最接近的令牌（hint/meta/caption/copy/body/lead/sub）；`text-[16px]` 允许（标题无令牌） |
| `rounded-2xl` / `rounded-xl` / `rounded-full`(徽章) | `rounded-block`(12px) / `rounded-panel`(10px) / `rounded-badge`(20px) |
| `rounded-lg` | `rounded-card`(8px) 或 `rounded-panel`(10px)，按语境 |
| `rounded-md` | `rounded-chip`(6px) |
| `border-[#d8c9b2]` / `border-[#d8d2c4]` | `border-paper-lineStrong`（#d8d2c4）/ `border-paper-line`（#e2dccd）——按原值 |
| `border-[#e4b9ab]` | `border-paper-dangerLine` |
| `border-[#ecd4ae]` | `border-paper-goldPale` |
| `bg-[#fdf3e4]` / `bg-[#f7f2e7]` / `bg-[#f7f3ea]` | `bg-paper-tint`（#f7f3ea） |
| `bg-[#faf0ec]` | `bg-paper-dangerTint` |
| `bg-[#fdfcf8]` | `bg-paper-sunken`（#faf8f2） |
| `bg-[#faf0ec]` | `bg-paper-dangerTint` |
| `bg-black/30`（弹窗遮罩） | `bg-paper-ink/45` |
| `text-[#b0492f]` | `text-paper-danger` |
| `text-[#6e4620]`(hover) | `text-paper-primaryHover`（按钮 `hover:bg-paper-primaryHover`） |
| `text-[#a8712e]` | `text-paper-primary`（或 gold，按语境） |
| `shadow-sm` / `shadow-lg` | `shadow-card` / `shadow-modal` |

**自检命令**（每 Task 后跑）：`rg -n 'text-2xl|text-sm|text-xs|text-5xl|text-base|#[0-9a-fA-F]{3,8}' <file>` → 应无匹配（`text-[16px]` 等允许值除外，注明）。

---

## File map

| 文件 | 职责 |
|---|---|
| `src/pages/create/CreateInput.tsx` | 输入卡：标题问句 + textarea + 时长芯片 + 生成按钮 |
| `src/pages/create/CreateProgress.tsx` | genLoading 单行 pulse + genError |
| `src/pages/create/SectionEditor.tsx` | 单段逐句编辑（编辑/换个说法 预览/采纳/再换/放弃），从 Create.tsx 搬出 + 令牌化 |
| `src/pages/create/ScriptView.tsx` | 三平台 Tab + 查重(不做) + 稿件(hook/body/cta 逐句) + 采纳/换个角度/复制全文 |
| `src/pages/create/CreateAside.tsx` | 右栏：引用卡片 + 「下划线即引用」提示 + 历史稿件 |
| `src/pages/Create.tsx` | 编排：queries(state) + genMut + 路由态(platform) + 组合子组件 |
| `prototypes/PROTOTYPE_GAP.md` | Create 行改令牌过/功能过；建议序 2 划完成 |

---

### Task 0: 后端 duration 契约（sks-ai → sks-server）+ 前端契约

> 跨三仓：sks-ai 进 prompt、sks-server 透传、sks-web 传参 + 接 dedupWarnScriptId。**先于前端 Task 1–5**，定契约。本地需重启 sks-server（IDEA rebuild）+ sks-ai（PyCharm reload）。

**Files:**
- Modify(sks-ai): `app/api/script_gen.py`、`app/skills/script_gen/graph.py`
- Modify(sks-server): `src/main/java/com/sks/aiclient/AiClient.java`、`src/main/java/com/sks/script/ScriptService.java`、`src/main/java/com/sks/script/ScriptController.java`
- Modify(sks-web): `src/api/script.ts`

**Interfaces:**
- Consumes: 无
- Produces: `generateScript(topicId, platform, duration)`（sks-web）；`ScriptDetail.dedupWarnScriptId`（sks-web）；sks-ai `ScriptGenRequest.duration` + `generate_script(..., duration)`；sks-server `AiClient.ScriptGenRequest.duration` + `ScriptService.generate(..., duration)` + `GenerateRequest.duration`

- [ ] **Step 1: sks-ai `ScriptGenRequest` 加 duration**

`app/api/script_gen.py` `ScriptGenRequest` 加字段：
```python
class ScriptGenRequest(BaseModel):
    user_id: int
    topic: TopicRequest
    profile: dict[str, Any] = Field(default_factory=dict)
    platform: str = "douyin"
    duration: str = "45"   # '45' | '90' | '180'（秒）；45=45秒口播，90=90秒，180=3分钟深度
```
`post_script_gen` 透传：
```python
result = await generate_script(
    user_id=req.user_id,
    topic=req.topic.model_dump(),
    profile=req.profile,
    platform=req.platform,
    duration=req.duration,
)
```

- [ ] **Step 2: sks-ai `generate_script` + state + prompt 注入**

`app/skills/script_gen/graph.py`：
- `ScriptGenState` TypedDict 加 `"duration": str`。
- `generate_script(user_id, topic, profile, platform, duration: str = "45")` → initial state 加 `"duration": duration`。
- `_build_messages(state)` 的 system prompt（现有 `f"平台: {platform}\n"` 那段）加一行：
```python
duration_label = {"45": "45 秒口播", "90": "90 秒", "180": "3 分钟深度"}.get(state.get("duration", "45"), "45 秒口播")
system += f"目标时长: {duration_label}（按此时长控制篇幅与结构）\n"
```
（system prompt 里告诉 GLM 按目标时长生成；45秒→精简钩子+痛点+转化，3分钟→深度展开。）

- [ ] **Step 3: sks-ai 自检**

Run: `cd /Users/rck/work/sks-ai && uv run pytest tests/ -v 2>/dev/null || python -c "from app.api.script_gen import ScriptGenRequest; print(ScriptGenRequest(user_id=1, topic={'title':'x'}))"`（确认无 import/类型错）。手测：`curl -X POST localhost:8000/ai/script_gen -H 'X-Service-Token: change_me_internal_shared_token' -H 'Content-Type: application/json' -d '{"user_id":1,"topic":{"title":"测试"},"duration":"180"}'`（看是否 200，不阻断）。

- [ ] **Step 4: sks-server `AiClient.ScriptGenRequest` 加 duration**

`AiClient.java` `ScriptGenRequest` record 加字段（对齐 Python snake_case）：
```java
public record ScriptGenRequest(
        @JsonProperty("user_id") long userId,
        @JsonProperty("topic") TopicRequest topic,
        @JsonProperty("profile") Map<String, Object> profile,
        @JsonProperty("platform") String platform,
        @JsonProperty("duration") String duration) {}
```

- [ ] **Step 5: sks-server `ScriptService.generate` + `ScriptController` 透传 duration**

`ScriptService.generate` 签名加 `String duration`，构造 `ScriptGenRequest` 时传入：
```java
public GenerateResult generate(long userId, long topicId, String platform, String duration) {
    ...
    String plat = resolvePlatform(userId, platform);
    String dur = (duration == null || duration.isBlank()) ? "45" : duration;
    ...
    new AiClient.ScriptGenRequest(
            userId,
            new AiClient.TopicRequest(topic.getTitle(), topic.getRationale() == null ? "" : topic.getRationale()),
            profile,
            plat,
            dur) {};
}
```
`ScriptController.generate` 调 `scriptService.generate(userId, req.topicId(), req.platform(), req.duration())`；`GenerateRequest` record 加 `String duration`（可空，默认 45 由 service 兜）。

- [ ] **Step 6: sks-server 自检**

Run: `cd /Users/rick/work/sks-server && ./mvnw -q -DskipTests compile`（确认编译过）。重启 sks-server。

- [ ] **Step 7: sks-web 契约——`generateScript` 加 duration + `ScriptDetail` 加 dedupWarnScriptId**

`src/api/script.ts`：
```ts
export function generateScript(topicId: number, platform?: string, duration?: '45' | '90' | '180'): Promise<ScriptDetail> {
  return userClient.post<ScriptDetail, ScriptDetail>('/scripts/generate', { topicId, platform, duration });
}
export interface ScriptDetail {
  ...existing...
  dedupWarnScriptId: number | null;   // 生成命中查重则非空（不阻断）
}
```

- [ ] **Step 8: 三仓 commit（各仓一提）**

```bash
# sks-ai
cd /Users/rick/work/sks-ai && git add app/api/script_gen.py app/skills/script_gen/graph.py && git commit -m "feat(ai): script_gen 接 duration 入参，进 system prompt 控制篇幅"
# sks-server
cd /Users/rick/work/sks-server && git add src/main/java/com/sks/aiclient/AiClient.java src/main/java/com/sks/script/ScriptService.java src/main/java/com/sks/script/ScriptController.java && git commit -m "feat(server): generate 透传 duration 给 sks-ai（AiClient/ScriptService/Controller）"
# sks-web
cd /Users/rick/work/sks-web && git add src/api/script.ts && git commit -m "feat(web): generateScript 加 duration 入参 + ScriptDetail.dedupWarnScriptId"
```

---

### Task 1: 拆分骨架 + `CreateInput`（自由 textarea + 时长 + 生成）

**Files:**
- Create: `src/pages/create/CreateInput.tsx`
- Modify: `src/pages/Create.tsx`（先只改根容器 + 标题 + 挂 `CreateInput`，其余子组件后续 Task 接）

**Interfaces:**
- Consumes: 无
- Produces: `export default function CreateInput(props: { topic: string; onTopic: (v: string) => void; duration: '45' | '90' | '180'; onDuration: (d: '45'|'90'|'180') => void; onGenerate: () => void; generating: boolean }): JSX.Element`

- [ ] **Step 1: 建 `CreateInput.tsx`**（逐样对齐 `13-文案创作.html` 第 7–17 行输入卡）

```tsx
const DURATIONS = [
  { id: '45', label: '45 秒口播' },
  { id: '90', label: '90 秒' },
  { id: '180', label: '3 分钟深度' },
] as const;

export default function CreateInput({ topic, onTopic, duration, onDuration, onGenerate, generating }: {
  topic: string;
  onTopic: (v: string) => void;
  duration: '45' | '90' | '180';
  onDuration: (d: '45' | '90' | '180') => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <section className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-6 py-[22px]">
      <div className="mb-2.5 text-copy font-bold text-paper-ink">这条视频想讲什么？</div>
      <textarea
        value={topic}
        onChange={(e) => onTopic(e.target.value)}
        placeholder="输入关键词、一句话选题，或粘贴要仿写的爆款文案…"
        rows={3}
        className="w-full resize-none rounded-card border border-paper-lineStrong bg-paper-sunken px-3.5 py-3 text-lead leading-normal text-paper-ink outline-none focus:border-paper-primary"
      />
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        <span className="text-meta text-paper-muted">时长</span>
        {DURATIONS.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onDuration(d.id)}
            className={
              duration === d.id
                ? 'rounded-badge border border-paper-primary bg-paper-tint px-3.5 py-[5px] text-caption text-paper-primary'
                : 'rounded-badge border border-paper-lineStrong px-3.5 py-[5px] text-caption text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary'
            }
          >
            {d.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || !topic.trim()}
          className="ml-auto rounded-card bg-paper-primary px-7 py-2.5 text-lead font-medium text-white hover:bg-paper-primaryHover disabled:cursor-not-allowed disabled:opacity-45"
        >
          {generating ? '生成中…' : '生成口播稿'}
        </button>
      </div>
    </section>
  );
}
```

> 时长 `duration` 仅 UI 态——`generateScript` 无 duration 入参，不发后端（注释标 display-only）。

- [ ] **Step 2: `Create.tsx` 改根容器 + 标题 + 挂 `CreateInput`**（其余暂留旧码，后续 Task 替换）

把 `<main className="mx-auto min-h-full max-w-5xl px-5 py-8">` 改为 `<div className="mx-auto max-w-[1040px]">`；标题 `text-2xl`「创作」改为 `font-serif text-title font-black`「文案创作」；删 header 里的「返回工作台」Link（侧边栏已有导航）与副标题 `text-sm`。加 `topic`/`duration` state，渲染 `<CreateInput .../>`（onGenerate 先占位 `() => {}`，Task 5 接 genMut）。

- [ ] **Step 3: 令牌自检 + build**

Run: `rg -n 'text-2xl|text-sm|text-xs|text-base|#[0-9a-fA-F]{3,8}' src/pages/create/CreateInput.tsx src/pages/Create.tsx`
Expected: CreateInput 无匹配；Create.tsx 暂允许残留（后续 Task 清）。
Run: `npm run build` → 通过。

- [ ] **Step 4: Commit**

```bash
git add src/pages/create/CreateInput.tsx src/pages/Create.tsx
git commit -m "feat(web): 创作页拆分起手 + CreateInput（自由 textarea + 时长芯片 + 生成，令牌对齐原型）"
```

---

### Task 2: `CreateProgress`（单行 pulse + error）+ genIdle 空态

**Files:**
- Create: `src/pages/create/CreateProgress.tsx`
- Modify: `src/pages/Create.tsx`（挂 `CreateProgress`，删旧三段 `<ol>` 进度 + 旧 genError 块；加 genIdle 空态）

**Interfaces:**
- Produces: `export default function CreateProgress({ error }: { error: string | null }): JSX.Element`（loading 由 `generating` prop 还是 error-only？——这里只渲染 error；loading 单行 pulse 由 `Create.tsx` 在 `generating` 时直接渲染一行，见 Step 2）

- [ ] **Step 1: `Create.tsx` 里 generating 时渲染原型单行 pulse**

在 `CreateInput` 下方：
```tsx
{generating && (
  <div className="mb-[18px] rounded-block border border-paper-line bg-paper-card px-[30px] py-7.5 text-center">
    <p className="animate-pulse text-lead text-paper-primary">
      ① 检索知识库 → ② 撰写口播稿 → ③ 安全审核 · 约 30-60 秒，完成后整稿一次呈现
    </p>
  </div>
)}
```
（删旧 `PROGRESS_STAGES`/`stage` 三段 `<ol>` 与 `setStage` effect——单行 pulse 不需要分阶段推进。）

- [ ] **Step 2: `CreateProgress.tsx` 只承载 error（统一错误样式）**

```tsx
export default function CreateProgress({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="mb-[18px] rounded-card border border-paper-dangerLine bg-paper-dangerTint px-3.5 py-2.5 text-copy text-paper-danger">
      {error}
    </div>
  );
}
```

- [ ] **Step 3: genIdle 空态**（无 script 且非 generating 时）

```tsx
{!script && !generating && (
  <div className="rounded-block border border-dashed border-paper-lineStrong px-10 py-10 text-center text-body text-paper-mutedLight">
    输入选题后点击「生成口播稿」，AI 会结合你的账号档案和知识库卡片来写
  </div>
)}
```

- [ ] **Step 4: 令牌自检 + build + commit**

```bash
rg -n 'text-2xl|text-sm|text-xs|text-base|#[0-9a-fA-F]{3,8}' src/pages/create/CreateProgress.tsx
npm run build
git add src/pages/create/CreateProgress.tsx src/pages/Create.tsx
git commit -m "feat(web): 创作页 genLoading 单行 pulse + error + genIdle 空态（令牌化）"
```

---

### Task 3: `SectionEditor`（逐句编辑搬出 + 令牌化）

**Files:**
- Create: `src/pages/create/SectionEditor.tsx`（从 `Create.tsx` 搬 `SectionEditor` 函数，逐行套 Token Map）
- Modify: `src/pages/Create.tsx`（删内嵌 `SectionEditor`，import 新文件——但本 Task 暂不挂，Task 5 在 ScriptView 里挂）

**Interfaces:**
- Consumes: `editSentence`/`rewriteSentence`/`getScript`/`parseSection`/`BizError`/`ScriptDetail`/`CardSummary` from `../api/...`；`SectionKey`/`SECTION_LABELS`（搬到此文件或 `create/types.ts`）
- Produces: `export default function SectionEditor({ scriptId, section, sentences, onEdited }: { scriptId: number; section: SectionKey; sentences: {idx:number;text:string}[]; onEdited: (s: ScriptDetail) => void }): JSX.Element`
  - 删 `fullScript` 入参（原 `SectionEditor` 收了但没用，TS6133 预存错之一，顺手清）。

- [ ] **Step 1: 搬 + 令牌化 `SectionEditor.tsx`**

把 `Create.tsx` 里 `SectionEditor` 整函数搬出，套 Token Map：
- 外层 `<section className="rounded-block border border-paper-line bg-paper-card p-6 shadow-card">`（原 `rounded-2xl shadow-sm`）
- 标题 `text-[12px]` → `text-meta`；`text-lg` → `text-sub`；`rounded-full border-[#ecd4ae] bg-[#fdf3e4] text-[#a8712e]` 徽章 → `rounded-badge border border-paper-goldPale bg-paper-tint px-2.5 py-1 text-hint font-bold text-paper-primary`
- 编辑 textarea `border-[#d8d2c4] bg-[#fdfcf8] text-sm` → `border-paper-lineStrong bg-paper-sunken text-body`；按钮 `bg-[#6e4620]`→`bg-paper-primaryHover`、`border-[#d8c9b2] bg-[#f7f2e7]`→`border-paper-goldPale bg-paper-tint`（次要按钮统一）
- 换个说法预览框 `border-[#ecd4ae] bg-[#fdf3e4]` → `border-paper-goldPale bg-paper-tint`；`text-[#b0492f]`→`text-paper-danger`
- 普通展示 `hover:bg-[#f7f2e7]/60` → `hover:bg-paper-tint/60`；`text-[11px]`→`text-hint`；`text-[15px]`→`text-sub`；`rounded-md border-[#d8c9b2]`→`rounded-chip border-paper-goldPale`

- [ ] **Step 2: 令牌自检 + build**

```bash
rg -n 'text-2xl|text-sm|text-xs|text-base|#[0-9a-fA-F]{3,8}' src/pages/create/SectionEditor.tsx
npm run build
```
Expected: 无匹配；build 通过（Create.tsx 此时还引用旧内嵌 SectionEditor，本 Task 先不删旧码以免断 build——见 Step 3 说明）。

> 说明：为保 build 不断，本 Task **先建 `SectionEditor.tsx` 但 Create.tsx 仍用内嵌的**。Task 5 建 ScriptView 时改 import 新文件并删内嵌。若想本 Task 即删内嵌，需同时改 Create.tsx 的 `ScriptEditor` 引用——留给 Task 5 一起。

- [ ] **Step 3: Commit**

```bash
git add src/pages/create/SectionEditor.tsx
git commit -m "feat(web): 抽出 SectionEditor 并令牌化（逐句编辑/换个说法）"
```

---

### Task 4: `ScriptView`（三平台 Tab + 稿件 + 采纳/换个角度/复制）

**Files:**
- Create: `src/pages/create/ScriptView.tsx`
- Modify: `src/pages/Create.tsx`（挂 ScriptView，删内嵌 `ScriptEditor`）

**Interfaces:**
- Consumes: `ScriptDetail`/`CardSummary`/`SectionEditor`；`SectionKey`
- Produces: `export default function ScriptView(props: ScriptViewProps)`

```ts
export interface ScriptViewProps {
  script: ScriptDetail;
  bCards: CardSummary[];
  platform: 'douyin' | 'xhs' | 'gzh';
  onPlatform: (p: 'douyin' | 'xhs' | 'gzh') => void;  // 切 Tab → Create.tsx 重生
  onAdopt: () => void;        // → navigate('/review')
  onRegenerate: () => void;   // 换个角度 → genMut 重生
  onEdited: (s: ScriptDetail) => void;  // 逐句编辑回灌
}
```

- [ ] **Step 1: `ScriptView.tsx`**（对齐原型第 26–69 行 genDone 左卡）

```tsx
import { Link } from 'react-router-dom';
import SectionEditor from './SectionEditor';
import { parseSection, type ScriptDetail, type SectionKey } from '../../api/script'; // SectionKey 见 types
import type { CardSummary } from '../../api/kb';

const TABS: { id: 'douyin'|'xhs'|'gzh'; label: string }[] = [
  { id: 'douyin', label: '抖音口播稿' },
  { id: 'xhs', label: '小红书图文（切换时生成）' },
  { id: 'gzh', label: '视频号版（切换时生成）' },
];
const SECTIONS: SectionKey[] = ['hook', 'body', 'cta'];

export default function ScriptView({ script, bCards, platform, onPlatform, onAdopt, onRegenerate, onEdited }: ScriptViewProps) {
  const fullText = SECTIONS.map((k) => parseSection(script[k]).map((s) => s.text).join('')).join('\n');
  return (
    <div className="overflow-hidden rounded-block border border-paper-line bg-paper-card">
      {/* 三平台 Tab */}
      <div className="flex border-b border-paper-line bg-paper-sunken">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPlatform(t.id)}
            className={
              platform === t.id
                ? 'border-b-2 border-paper-primary px-5 py-3 text-body font-bold text-paper-primary'
                : 'px-5 py-3 text-body text-paper-inkSoft hover:text-paper-primary'
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-[26px] py-6">
        {/* 查重提醒（dedupWarnScriptId 命中、不阻断）——对齐原型第 34 行黄条 */}
        {script.dedupWarnScriptId != null && (
          <div className="mb-[18px] rounded-chip border border-paper-dangerLine bg-paper-dangerTint px-3.5 py-2.5 text-caption leading-normal text-paper-danger">
            本稿与历史稿件 #{script.dedupWarnScriptId} 相似度较高——可「换个角度」重写，或继续采用。
          </div>
        )}
        {/* 稿件：逐句编辑（保留真 API） */}
        <div className="flex flex-col gap-5">
          {SECTIONS.map((k) => (
            <SectionEditor key={k} scriptId={script.id} section={k} sentences={parseSection(script[k])} onEdited={onEdited} />
          ))}
        </div>
        {/* 采纳 / 换个角度 / 复制全文 */}
        <div className="mt-[22px] flex gap-2.5 border-t border-paper-tintDeep pt-[18px]">
          <button type="button" onClick={onAdopt} className="rounded-card bg-paper-primary px-5 py-2.5 text-body font-medium text-white hover:bg-paper-primaryHover">采纳</button>
          <button type="button" onClick={onRegenerate} className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary">换个角度</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(fullText)} className="rounded-card border border-paper-lineStrong px-5 py-2.5 text-body text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary">复制全文</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `Create.tsx` 挂 ScriptView + 删内嵌 ScriptEditor + platform 态**

加 `const [platform, setPlatform] = useState<'douyin'|'xhs'|'gzh'>('douyin')`。`genMut.mutate({ topicId, platform })`。切 Tab `onPlatform={(p) => { setPlatform(p); genMut.mutate({topicId, platform: p}); }}`。`onAdopt={() => navigate('/review')}`。`onRegenerate={() => genMut.mutate({topicId, platform})}`。渲染 `{script && <ScriptView .../>}`。

- [ ] **Step 3: 令牌自检 + build + commit**

```bash
rg -n 'text-2xl|text-sm|text-xs|text-base|#[0-9a-fA-F]{3,8}' src/pages/create/ScriptView.tsx src/pages/Create.tsx
npm run build
git add src/pages/create/ScriptView.tsx src/pages/Create.tsx
git commit -m "feat(web): 创作页 ScriptView 三平台 Tab + 采纳/换个角度/复制全文（令牌化）"
```

---

### Task 5: `CreateAside`（引用卡 + 提示 + 历史稿件）+ 删 `CreateTopicButton`

**Files:**
- Create: `src/pages/create/CreateAside.tsx`
- Modify: `src/pages/Create.tsx`（挂 CreateAside，删 `CreateTopicButton` 函数 + 选题 picker 区 + 历史稿件内嵌）

**Interfaces:**
- Produces: `export default function CreateAside({ script, bCards, history }: { script: ScriptDetail | null; bCards: CardSummary[]; history: ScriptSummary[] }): JSX.Element`

- [ ] **Step 1: `CreateAside.tsx`**（对齐原型第 71–89 行右栏 + 保留历史稿件）

```tsx
import { Link } from 'react-router-dom';
import type { CardSummary } from '../../api/kb';
import type { ScriptDetail, ScriptSummary } from '../../api/script';

export default function CreateAside({ script, bCards, history }: { script: ScriptDetail | null; bCards: CardSummary[]; history: ScriptSummary[] }) {
  const cited = script && script.citedCardIds.length > 0;
  return (
    <aside className="flex flex-col gap-3">
      {cited && (
        <>
          <div className="text-copy font-bold text-paper-inkSoft">本稿引用的知识卡片</div>
          {script!.citedCardIds.map((cid) => {
            const c = bCards.find((x) => x.id === cid);
            return (
              <div key={cid} className="rounded-panel border border-paper-line bg-paper-card px-4 py-3.5">
                <div className="mb-1.5 text-hint font-bold text-paper-primary">{c ? c.cardType : `卡 #${cid}`}</div>
                <div className="mb-1 text-body font-medium text-paper-ink">{c ? c.title : `卡 #${cid}`}</div>
                <div className="text-meta leading-normal text-paper-muted">{c ? c.content.slice(0, 40) : '—'}</div>
              </div>
            );
          })}
          <div className="rounded-panel border border-dashed border-paper-goldSoft bg-paper-tint px-4 py-3 text-caption leading-normal text-paper-primary">
            引用卡片来自知识库 B 层；发现信息过时？去「知识库」更新。
          </div>
        </>
      )}
      {/* 历史稿件（B 保留真功能） */}
      <div className="text-copy font-bold text-paper-inkSoft">历史稿件</div>
      {history.length === 0 ? (
        <p className="text-meta text-paper-muted">暂无草稿稿件。</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {history.map((s) => (
            <li key={s.id}>
              <Link to="/review" className="block rounded-card border border-paper-line bg-paper-base px-2.5 py-1.5 text-meta text-paper-ink hover:bg-paper-tint">
                #{s.id} · {s.platform} · {s.reviewState}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
```

- [ ] **Step 2: `Create.tsx` 整体收口**

- 删 `CreateTopicButton` 函数、选题 picker `<section>`、内嵌历史稿件 `<section>`、`ScriptEditor` 函数（Task 3/4 已搬出）。
- `topic` 输入态：`onGenerate` → 若 `topic.trim()`，`createTopic(topic.trim(), '')` 拿 `topicId` → `genMut.mutate({topicId, platform})`（用 createTopic mut 或直接 await）。
- 布局：`<div className="mx-auto max-w-[1040px]">` 标题 + `<CreateInput/>` + `{generating && pulse}` + `<CreateProgress error={genError}/>` + `{script ? <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[1fr_280px]"><ScriptView.../><CreateAside.../></div> : genIdle}`。
- 删 `topics` query（不再用 picker）、`history` query 保留（`listScripts('draft')`）给 CreateAside。

- [ ] **Step 3: 令牌自检 + build + commit**

```bash
rg -n 'text-2xl|text-sm|text-xs|text-base|#[0-9a-fA-F]{3,8}' src/pages/create/CreateAside.tsx src/pages/Create.tsx
npm run build
git add src/pages/create/CreateAside.tsx src/pages/Create.tsx
git commit -m "feat(web): 创作页 CreateAside 引用卡+历史稿件；Create 收口（删 picker/CreateTopicButton，自由 textarea→createTopic→generate）"
```

---

### Task 6: 更新 `PROTOTYPE_GAP.md`

**Files:**
- Modify: `prototypes/PROTOTYPE_GAP.md`（Create 行 → 令牌过/功能过；建议序 2 划完成；backlog 第 2 条标完成）

- [ ] **Step 1: 改 Create 行**

矩阵第 13 行改为：骨架过 / 令牌过 / 功能过；证据「自由 textarea+时长芯片(真传后端控篇幅)+三平台 Tab(切换重生)+逐句编辑(保留真 API)+查重黄条(dedupWarnScriptId)+采纳/换个角度/复制全文+引用侧栏+历史稿件；内联下划线引用无 API 未做（接受）」；建议序 `—`。

- [ ] **Step 2: backlog 第 2 条标完成**

`2. ~~文案创作~~ ✅ 完成（令牌过线；时长真传后端；查重接 dedupWarnScriptId；内联下划线引用无 API 延期）`

- [ ] **Step 3: Commit**

```bash
git add prototypes/PROTOTYPE_GAP.md
git commit -m "docs: gap Create 行令牌/功能过；建议序 2 完成"
```

---

## 本计划不包含（后续单独开 plan）

- 正文内联下划线引用（后端需返句子级 citedCardId 位置，现仅给卡 ID 列表）。
- 落地页/其他页对齐（建议序 3+）。

---

## Self-review（写作时已执行）

1. **Spec coverage**：Gap Create「令牌不过 + 功能偏（缺自由选题框/时长芯片/三平台Tab/查重条）」→ Task 0–6 全覆盖。时长真传后端（Task 0 跨仓）；查重接 dedupWarnScriptId（Task 4）；内联下划线引用无 API 延期。逐句编辑保留（B 决策）。
2. **Placeholder scan**：无 TBD；时长 display-only 注明；查重注明无 API 不做。
3. **Type consistency**：`CreateInput`/`ScriptViewProps`/`CreateAside` 入参前后一致；`SectionKey` 在 SectionEditor/ScriptView 共用（建议落 `src/pages/create/types.ts`，Task 3 建）。`platform: 'douyin'|'xhs'|'gzh'` 在 Create.tsx/ScriptView 一致。`createTopic`/`generateScript(topicId, platform?)` 签名已核实存在。
4. **Scope**：仅 Create 一切片，可独立交付。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-create-prototype-fidelity.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 我每 Task 派新 subagent，Task 间 review，快迭代。
2. **Inline Execution** — 本会话用 executing-plans 批量执行 + checkpoint。

哪种？
