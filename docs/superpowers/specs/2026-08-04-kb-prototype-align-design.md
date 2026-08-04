# D3 · 知识库页对齐原型 — 设计 spec

> **范围**：交付物 D3（D1+D2 已合入 main）。把 `KB.tsx`(`/kb`) 从「tab + text-2xl/sm + 裸 hex + 无补卡/缺卡」对齐原型 `15-知识库.html`：三层三列网格 + 令牌化 + deferred 诚实占位。
> **尺子**：`prototypes/extracted/sections/15-知识库.html` 为视觉基准（只读不改）；令牌过线 B。
> **仓**：**仅 sks-web**（纯前端，无后端改动）。`api/kb.ts` 已有 CRUD，`listCards()` 无 layer 过滤即可取全量。
> **基准日期**：2026-08-04。

## 1. 目标与背景

`KB.tsx` 现状（见 `PROTOTYPE_GAP.md` 行 15）：令牌不过（`text-2xl`/`text-sm`/`text-xs` + 裸 hex）；结构是 A/B/C **tab** 切换（一次一层），原型是三层三列网格全可见；无对话补卡/缺卡提醒；副文案无 count。

原型（section 15）：header「知识库」+「23 张卡片 · 活卡率 74%」+「+ 对话补卡」；A 层三列网格（人设声音）；B 层三列网格（业务事实）；缺卡提醒/已补卡位；C 层三列 stat 卡（内容资产·自动沉淀：历史稿件/改稿记录/表现数据）；dashed 空态（先完成定位校准 / 直接回答一个问题建卡）。

## 2. 非目标

- **不改后端契约**：`listCards()` 已支持无 layer（取全量），无需改 `api/kb.ts` 或 sks-server。
- **不删库里 C 卡**：现有 C 层卡（金句素材）仍在数据库，只是 KB 页不再展示/管理——产品方向是 C=auto-沉淀 stat（非用户 CRUD）。
- **不接 supplement/gap API**：对话补卡、缺卡提醒（gap 检测）、活卡率、C 层 stat 均无后端，全部 deferred（disabled「规划中」占位），不造假数据。
- **C 层 CRUD 移除**：原型 C 层是 stat 占位，不是 CRUD 卡；新建只能 A|B（见 §5）。
- **Header CTA 与原型有意不一致（差异，非缺陷）**：原型主按钮是「+ 对话补卡」（无补卡 API）；本设计 working 创建入口用「+ 新建卡片」（手动表单，API 已支持），「+ 对话补卡」作 disabled「规划中」占位贴原型。验收不得以「主按钮不像原型」判偏——working 入口必须保留（否则用户无法建卡）。
- **不改原型 HTML**。

## 3. 令牌迁移表

| 现 | 改 |
|---|---|
| `text-2xl font-black`（h1） | `font-serif text-title font-black` |
| `text-sm` / `text-[13px]` / `text-[12px]` / `text-[11px]` / `text-xs` | `text-body` / `text-copy` / `text-meta` / `text-hint` |
| `text-base` / `text-lg` | `text-body` / `text-[18px]`（步骤/标题层级） |
| `rounded-2xl` / `rounded-lg` / `rounded-full` | `rounded-block`(12) / `rounded-card`(8) / `rounded-badge`(20) |
| `shadow-sm` / `shadow-lg` | 弹窗用 `shadow-modal`；卡片无 shadow（原型白底+描边） |
| 裸 hex（`#6e4620` `#d8c9b2`/#`d8d2c4` `#f7f2e7` `#ecd4ae` `#fdf3e4` `#b0492f` `#faf0ec` `#e4b9ab` `#fdfcf8` `#8a3a25` `#f5e0d8` `#a8712e`） | `paper.primaryHover` / `paper.lineStrong` / `paper.tint` / `paper.goldPale` / `paper.tint` / `paper.danger` / `paper.dangerTint` / `paper.dangerLine` / `paper.sunken` / `paper.dangerHover` / `paper.dangerTint` / `paper.gold` |
| `max-w-3xl`（768px） | **`max-w-[880px]`**（原型 880px） |

## 4. 结构重塑

删 A/B/C tab。改为 A/B/C 三层**各自三列网格全可见**，顺序照原型：A → B → 缺卡提醒位 → C。

- `listCards()`（**无 layer 过滤**）一次取全量 → 前端 `filter(c=>c.layer==='A')` / `==='B'` 分两组。**queryKey 改 `['kb-cards']`**（去掉按 layer 的 key）；`invalidate` 同步改 `['kb-cards']`。
- **响应式**：网格 `grid grid-cols-1 md:grid-cols-3 gap-3`（桌面三列对齐原型，手机单列不挤）。

### 4.1 Header
「知识库」（`font-serif text-title font-black`）+ 副文案「`{N} 张卡片 · 活卡率 规划中`」（N = A.length + B.length 真实计数；「活卡率 规划中」disabled 样式 `text-paper-mutedLight`）+「+ 新建卡片」主按钮（working，`bg-paper-primary`，openCreate）+「+ 对话补卡」disabled「规划中」（`opacity-45 cursor-not-allowed`，不响应点击）。

### 4.2 A 层
eyebrow「A 层 · 人设声音（每次生成必用）」（`text-meta tracking-wide font-bold text-paper-primary`）。三列网格卡片：`bg-paper-card border-paper-line rounded-panel px-[18px] py-4`，title（`text-body font-bold`）+ desc（`text-caption text-paper-inkSoft`，A 层用 `displayContent(content)`）+ 编辑/删除按钮（`rounded-chip` 小按钮）。

### 4.3 B 层
eyebrow「B 层 · 业务事实（按选题检索）」。三列网格卡片，**字段映射**（钉死）：
- **tag → `card.cardType`**（`text-hint font-bold text-paper-primary`）
- **title → `card.title`**（`text-body font-bold`）
- **meta → `displayContent(card.content)` 截断两行摘要**（`text-meta text-paper-muted line-clamp-2`）——**不得用「更新于…」冒充 meta**；`updatedAt` 移到卡片角标或省略。

### 4.4 缺卡提醒位
放在 **B 网格与 C 之间**（照原型位置）。disabled 占位 box：`rounded-panel border border-paper-dangerLine bg-paper-dangerTint px-[18px] py-3.5`，文案「缺卡提醒：规划中」+ disabled「语音回答」按钮（`bg-paper-danger opacity-45 cursor-not-allowed`）。

### 4.5 C 层
eyebrow「C 层 · 内容资产（自动沉淀）」。3 个 disabled stat 占位卡（`bg-paper-sunken border-paper-line rounded-panel px-[18px] py-4 opacity-60`）：
- 「历史稿件」· 规划中
- 「改稿记录」· 规划中
- 「表现数据」· 规划中

**移除 C 层 CRUD**——不取 C 卡、不渲染 C 卡片、不提供 C 新建/编辑。库里已有 C 卡 UI 不展示（见 §2 非目标）。

### 4.6 Empty state
**判定**：`aCards.length + bCards.length === 0`（**忽略 C**；仅有历史 C 卡时仍走空态）。dashed box（`border border-dashed border-paper-lineStrong rounded-block px-10 py-11 text-center`）+「知识库还是空的」（`font-serif text-[18px] font-black`）+ 说明 + 两按钮：「先完成定位校准」（`<Link to="/calibrate">`，working，`bg-paper-primary`）+「直接回答一个问题建卡」（disabled 规划中，`border-paper-primary text-paper-primary opacity-45 cursor-not-allowed`）。

## 5. CardModal 层限制（钉死）

去掉 C CRUD 后：
- **新建**：layer 选择只 `A | B`（不出现 C）。Modal 内 layer 固定（由调用方传，当前页 active layer 或新建时选 A/B）。
- **编辑**：沿用卡**自身 layer**（`editing.layer`），**不出现切到 C** 的选项。
- B 层保存「已重算向量」提示保留（`LAYER_HINTS.B`）。
- Modal 令牌化同 §3。

## 6. 删除二次确认（保留，不变行为）

引用保护 4006 逻辑不动：删除时后端返 4006 → 弹二次确认「有 N 篇稿件引用此卡」+「仍然删除」（force=true 软删）。仅令牌化样式。

## 7. 错误处理

- `listCards()` 失败 → 「加载失败」占位（令牌化）。
- empty（A+B=0，含仅有 C 卡）→ dashed 空态。
- deferred 占位无交互、不触发请求。

## 8. 测试

sks-web vitest = `environment:'node'`、`include:['src/**/*.test.ts']`、无 jsdom——纯函数单测（照 `homeMode.test.ts`/`calibrateMode.test.ts`）。
- 抽 `displayContent`/`wrapContent`（现 KB.tsx 模块内私有）到 `src/lib/kbText.ts`（DRY + 可测），KB import。
- 新增 `src/lib/kbText.test.ts`：`displayContent`（JSON 字符串→原文 / JSON 对象→pretty / 非 JSON→原文 / 空→''）；`wrapContent`（文本→JSON 字符串）。不渲染组件。

## 9. 契约文档

不改 `REST_CONTRACT.md`（KB 后端契约不变）、不改 sks-ai `API_CONTRACT.md`。

## 10. 验收（对齐 PROTOTYPE_GAP 行 15）

- 令牌：过——主体无 `text-2xl/sm/xs` 冒充、无裸 hex，色/字号/圆角走 `tailwind.config.js`，`max-w-[880px]`。
- 功能：过——主路径（A/B 三层三列网格 CRUD + 引用保护 + CardModal A/B）齐；deferred（对话补卡/缺卡/活卡率/C stat）诚实 disabled 占位「规划中」；C 层 CRUD 移除（方向 C=auto-沉淀）。
- 过线后更新 `PROTOTYPE_GAP.md` 行 15 令牌不过→过/功能偏→过 + backlog 4 划完成。
