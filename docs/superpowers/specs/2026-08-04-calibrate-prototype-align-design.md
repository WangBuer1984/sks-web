# D1 · 校准对话页对齐原型 — 设计 spec

> **范围**：交付物 D1（共两个交付物中的第一个）。第二个交付物 D2（账号定位回放面板）另出 spec。
> **尺子**：`prototypes/extracted/sections/10-校准对话.html` 为视觉基准（只读不改）；令牌过线 B = 结构齐 + 色/字号/圆角走 `tailwind.config.js` / `TOKENS.md`。
> **仓**：sks-web（前端重塑）+ sks-server（Java 网关加端点）+ sks-ai（Python 加端点）。
> **基准日期**：2026-08-04。

## 1. 目标与背景

`Calibrate.tsx`（`/calibrate`）当前与原型差距大（见 `prototypes/PROTOTYPE_GAP.md` 矩阵行 30）：

- **令牌不过**：`text-2xl`/`text-sm` 主导 + 一批裸 hex（`#d8d2c4` `#f7f3e7` `#6e4620` `#b0492f` `#faf0ec` `#e4b9ab` `#fdfcf8` `#d8d9b2` `#ecd4ae` `#fdf3e4` 等）。
- **功能偏**：缺原型的三步进度条、三步卡片结构、Step2 人设确认气泡 + 确认/否认胶囊、Step3 档案四宫格呈现；草稿直接 `JSON.stringify` 摆 `<pre>`。原型 Step3 的「试试效果」对比块缺。

后端访谈流程已通（贴素材 → 问答 → 确认可走，`/api/profile/interview` + sks-ai LangGraph 状态机 `guess_persona / await_feedback / ask / summarize`，MAX_ROUNDS=5，Postgres checkpoint）。本 spec **不动后端访谈状态机**，只做表现层重塑 + 令牌化 + 新增「样例开头」只读端点。

## 2. 非目标

- **不**改访谈状态机、不加「提前结束归纳」信号。原型 Step2 底栏「生成定位档案 →」按钮降级为「提交本轮回答」（后端 done 了自然进 Step3）；提前结束作为后续增强。
- **不**改后端 `InterviewStepView` / `InterviewStepRequest` 形状（只新增一个 sample-opening 端点）。
- **不**做 D2（账号定位回放面板）——另 spec。
- **不**改原型 HTML（只读）。

## 3. 架构总览

状态机不动。Calibrate.tsx 单文件改写 + `api/profile.ts` 加一个函数；后端两处加只读端点。

| 层 | 文件 | 改动 |
|---|---|---|
| sks-web | `src/pages/Calibrate.tsx` | 表现层重塑 + 令牌化 |
| sks-web | `src/api/profile.ts` | 加 `sampleOpening(sessionId, topic?)` |
| sks-server | `ProfileController.java` | 加 `POST /api/profile/sample-opening` |
| sks-server | `AiClient.java` | 加 typed 方法 `sampleOpening(...)` + 请求/响应 record |
| sks-ai | `app/api/interview.py` | 加 `POST /ai/interview/sample-opening` |
| sks-ai | `app/skills/interview/` | 加 sample-opening 生成函数（一个 prompt 产两版 hook） |

**跨仓调用链**：sks-web `POST /api/profile/sample-opening {sessionId, topic?}` → sks-server 拼 `threadId=userId:sessionId` → sks-ai `POST /ai/interview/sample-opening {user_id, thread_id, topic?}` → 读 checkpoint 取 `profile` → 一个 prompt 同时产 `{without, with}` 两版开场钩子。

## 4. 三步进度条（phase → step 映射）

- Step1 = `phase === 'materials'`
- Step2 = `phase === 'await_feedback' || 'ask' || 'summarize'`
- Step3 = `phase === 'done'`

`currentStep ∈ {1,2,3}`。3 段 `h-[5px] rounded-[3px]`，`i < currentStep` 段 `bg-paper-primary`，其余 `bg-paper-shade`。

## 5. 前端重塑细节（D1a，sks-web）

### 5.1 令牌迁移表

| 现 | 改 | 备注 |
|---|---|---|
| `text-2xl font-black`（h1） | `font-serif text-title font-black` | 26px 衬线 900；h1 文案「定位校准」→「校准定位」照原型 |
| `text-sm text-paper-muted`（副标题） | 删除副标题 | 原型 header 只有标题 + 退出链接 |
| `text-lg font-bold`（步骤标题 18px） | `text-[18px] font-bold` | 18px ×6 在原型是明确层级，保留任意值，不拿 text-sub(15) 冒充 |
| `text-sm`（正文/气泡/输入框） | `text-body`(13.5) / `text-copy`(13) | 气泡/输入用 text-body，元数据用 text-copy |
| `text-[13px]` / `text-[12px]` / `text-[11px]` / `text-[11.5px]` / `text-[12.5px]` | `text-copy` / `text-meta` / `text-hint` / `text-caption` | 按语境对号 |
| `rounded-2xl`(16px) | `rounded-block`(12px) | 原型卡片 12px |
| `rounded-lg`(8px) | `rounded-card`(8px) | |
| `shadow-sm` | 去阴影 | 原型卡片「白底+描边」无阴影 |
| 裸 hex 全量 | `paper.*` token | 见下表 |

裸 hex → token：

| hex | token |
|---|---|
| `#d8d2c4` / `#d8c9b2` | `paper.lineStrong` |
| `#f7f2e7` | `paper.tint` |
| `#fdf3e4` | `paper.tint`（暖淡底，最接近） |
| `#fdfcf8` | `paper.sunken` |
| `#6e4620` | `paper.primaryHover` |
| `#8a5a2b` | `paper.primary` |
| `#b0492f` | `paper.danger` |
| `#faf0ec` | `paper.dangerTint` |
| `#e4b9ab` | `paper.dangerLine` |
| `#ecd4ae` | `paper.goldPale` |
| `#c9b997` | `paper.goldSoft` |

### 5.2 header

```
[校准定位]  (font-serif text-title font-black)        [保存并退出 / 返回工作台]  (text-copy text-paper-muted hover:text-paper-primary)
```
- 退出链接：行为不变（跳 `/workbench`），标签照原型改「保存并退出」。访谈状态留在 checkpoint，重进 `/calibrate` 同 sessionId 可续（后端 thread_id 寻址天然支持，**本期不验证续聊路径**，仅标签对齐）。

### 5.3 Step1 · 贴素材

- eyebrow：`第 1 步 · 共 3 步 · 约 3 分钟`（`text-meta tracking-wide font-bold text-paper-primary`）
- 标题：`先给我一点「你」的素材`（`text-[18px] font-bold`）
- 说明：13.5px `text-paper-inkSoft`，原文照原型。
- textarea：`bg-paper-sunken border-paper-lineStrong rounded-card text-body`，placeholder「粘贴主页链接或一段你写过的文案…」
- 「用示例：王姐的抖音主页」虚线胶囊（`border-dashed border-paper-goldSoft text-paper-primary rounded-badge`）→ onClick 把示例文案塞进 textarea。
- 「没有素材，直接聊」次按钮（`border-paper-lineStrong text-paper-inkSoft hover:border-paper-primary hover:text-paper-primary`）→ `submitMaterials` 允许 materials 为空：`stepMut({ materials: null })`。
- 主按钮「开始校准」（`bg-paper-primary text-white hover:bg-paper-primaryHover`）→ `submitMaterials`。

### 5.4 Step2 · 确认人设 + 问答

- eyebrow：`第 2 步 · 确认并补充 · 约 8 分钟`
- **AI 气泡**（每条 AI turn）：`bg-paper-tint rounded-[10px_10px_10px_2px] max-w-[94%] text-body leading-relaxed`，左对齐。
- `await_feedback` 阶段：在最新 AI 气泡下挂两枚胶囊（`rounded-badge`）：
  - 「基本对」→ 提交 `reply="基本对"`（快捷回复，走 `submitReply` 预填）。
  - 「不太对，我来说」→ 聚焦回答 textarea（不提交，等用户打字）。
- **用户回答框**：`bg-paper-sunken border-paper-lineStrong rounded-[10px_10px_3px_12px] text-body`（反向非对称圆角）。
- 底栏分隔（`border-t border-paper-tintDeep`）：`正式版会连续问 5–8 个问题…原型演示只走一问`（`text-meta text-paper-mutedLight`）+ 主按钮「生成定位档案 →」（= 提交本轮回答 `submitReply`，后端 done 自动进 Step3）。
- 按住录音按钮保留（现有语音流程不变），令牌化样式。

### 5.5 Step3 · 档案确认

- eyebrow：`第 3 步 · 你的定位档案`
- **四宫格**（`grid grid-cols-2 gap-3 text-body`）：每格 `bg-paper-sunken border-paper-tintDeep rounded-card px-3.5 py-3`，标题 `text-hint font-bold text-paper-primary`，值 `leading-normal`，缺键降级显示 `text-paper-mutedLight`「档案里没有这一项」。

  | 卡片标题 | draft 键 |
  |---|---|
  | 人设 | `人设` |
  | 目标人群 | `人群` |
  | 差异化 | `差异化` |
  | 表达红线 | `红线` |

  渲染复用 `Positioning.tsx` 的 `asText()`（字符串/数组/对象统一降级）。
- **「试试效果」对比块**（见 §6）：`bg-paper-tint border-l-[3px] border-paper-primary rounded-card px-4 py-3 text-caption`：
  - `同一个选题「{topic}」——`
  - 无档案版开头：`text-paper-muted` `无档案版开头：「{without}」`
  - 有档案版开头：`text-paper-primary font-bold` `有档案版开头：「{with}」`
- 按钮：`再补充几句`（次，`setPhase('ask')` 继续访谈）+ `确认档案，开始创作`（主，`confirmMut.mutate()` → `/workbench`）。

## 6. 样例开头端点（D1b）

### 6.1 sks-ai `POST /ai/interview/sample-opening`

- router：`app/api/interview.py`（已有 `prefix="/ai/interview"` + `verify_service_token`）。
- 请求（pydantic）：`{ user_id: int, thread_id: str, topic: str | None }`
- 实现：
  1. `config = {"configurable": {"thread_id": thread_id}}`；`sv = await _graph.aget_state(config)`；`profile = sv.values.get("profile")`。无 checkpoint / 无 profile → 404 翻译为 `AI_FAILED` 或显式 `not_found`（由 sks-server 翻译）。
  2. topic 默认固定示例选题 `报价为什么差一倍`（对齐原型 `10-校准对话.html` 的示例文案）；可被入参覆盖。
  3. 一个 LLM prompt：给定该 profile + topic，同时产出两版开场钩子——A **不带**定位（通用口吻）、B **带**该定位档案口吻。schema `{without: str, with: str}`。
  4. 返回 `{topic, without, with}`。
- 新 prompt 构建函数放 `app/skills/interview/sample_opening.py`（新文件），复用现有 LLM client 基础设施（参考 `graph.py` 里 `_call_llm` / `script_gen` 的调用模式，实现时再对齐）。
- 安全：产出过 safetyCheck（参考其他端点做法），blocked 则返回 `blocked=true, without=None, with=None`。

### 6.2 sks-server `POST /api/profile/sample-opening`

- `ProfileController` 新增端点，落在 user SecurityFilterChain，`@AuthenticationPrincipal Long userId`。
- 请求 record `SampleOpeningRequest(String sessionId, String topic)`（topic 可空）。
- 拼 `threadId = userId + ":" + sessionId`，调 `aiClient.sampleOpening(threadId, topic)`。
- 响应 `ApiResponse<SampleOpeningView>`，`record SampleOpeningView(String topic, String without, String with, boolean blocked)`。
- 失败翻译：sks-ai 非 2xx → `AI_FAILED`（沿用 `AiClient.post()` 基座）。

### 6.3 sks-server `AiClient.sampleOpening`

- typed 方法，POST `/ai/interview/sample-opening`，请求 record `SampleOpeningRequest(@JsonProperty thread_id, @JsonProperty user_id, topic)`（对齐 snake_case），响应 record `SampleOpeningResponse(@JsonIgnoreProperties(ignoreUnknown=true) topic, without, with, blocked)`。
- 照 `scriptGen` / `interviewStep` 模式抄。

### 6.4 sks-web 接线

- `api/profile.ts` 加：
  ```ts
  export interface SampleOpeningView { topic: string; without: string | null; with: string | null; blocked?: boolean }
  export function sampleOpening(sessionId: string, topic?: string): Promise<SampleOpeningView>
  ```
- Calibrate `done` 阶段：`useMutation({ mutationFn: () => sampleOpening(sessionId) })`，进 done 时触发（`useEffect` on `phase==='done'`）。成功且非 blocked → 渲染对比块；失败/blocked → 静默不渲染对比块，不阻断 confirm。

## 7. 错误处理

- 样例开头失败：静默隐藏对比块，Step3 仍可 confirm（对比块是锦上添花，非阻塞）。
- 访谈推进失败 / blocked：沿用现有 `error` / `banner` 渲染，令牌化样式（`bg-paper-dangerTint border-paper-dangerLine text-paper-danger`）。
- sample-opening 无 checkpoint：sks-ai 返回 not found，sks-server 翻译，前端按失败处理（隐藏对比块）。

## 8. 测试

- sks-web：`Calibrate` 已有的交互流不回归（贴素材→问答→confirm）。新增 `sampleOpening` mock 用例：done 阶段触发、成功渲染对比块、失败隐藏。进度条 currentStep 在各 phase 的断言。沿用 `src/pages/workbench/homeMode.test.ts` 的 vitest 模式。
- sks-server：`ProfileServiceTest` 照现有 `@MockBean AiClient` 模式加 `sampleOpening` 桩用例（threadId 拼接 + 响应装配 + 404 翻译）。
- sks-ai：`app/api/interview.py` 新端点加 pytest——mock `_graph.aget_state` 返回带 profile 的 state，断言两版 hook 形状；无 checkpoint 走 not found。

## 9. 契约文档

- `sks-server/docs/REST_CONTRACT.md`「定位校准」段（`:160`）补 `POST /api/profile/sample-opening` 行；并顺手补漏列的 `GET /api/profile`。
- `sks-ai/docs/API_CONTRACT.md` 端点总表补 `/ai/interview/sample-opening`。

## 10. 验收口径（对齐 PROTOTYPE_GAP.md 行 30）

- **骨架**：过（路由可达，不变）。
- **令牌**：过——主体无 `text-2xl/sm/xs` 冒充，无裸 hex（频次 <3 的局部值例外并注明），色/字号/圆角走 `tailwind.config.js`。
- **功能**：过——三步进度条 + 三步卡 + Step2 人设确认气泡/胶囊 + Step3 四宫格 + 试试效果对比块（接端点）齐；草稿不再 `JSON.stringify`。
