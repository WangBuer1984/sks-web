# 原型对齐 Gap（C 端）

> **状态**：2026-08-01 对照仓库现状手审。过时诊断（「无落地页 / 无侧边栏 / 四段缺路由」）作废。  
> **尺子**：令牌过线（B）——结构齐 + 色/字号/圆角走 `TOKENS.md` / `tailwind.config.js`；不要求截图像素 diff。  
> **机器层**：段 ↔ 文件见 [`extracted/SECTIONS.md`](extracted/SECTIONS.md)（`node scripts/extract-prototype.mjs` 生成）。本文件只写保真与功能。

## 判定口径

| 列 | 过 | 不过 / 偏 / 缺 |
|---|---|---|
| **骨架** | 有 React 文件且路由可达（落地页五段可合写在 `Landing.tsx`） | 无文件或进不去 |
| **令牌** | 主区块在；`paper.*` + `text-body/title/display/…`；主体不用 `text-2xl/sm/xs` 冒充；常见色不裸 hex（频次 &lt;3 的局部值可例外并注明） | 证据一句 |
| **功能** | 原型主路径可走（含关键空态/加载） | **偏**=主路径有但缺明确子块；**缺**=主路径未接或产品形态不对 |

命名：提取段名「历史稿件」= UI/侧栏「发布复盘」= 路由 `/review`。

## 矩阵

| # | 段 | 原型条件 | React | 骨架 | 令牌 | 功能 | 证据 / 缺口 | 建议序 |
|---|---|---|---|---|---|---|---|---|
| 1 | 顶栏 | — | `Landing.tsx` `/` | 过 | 过 | 过 | sticky + 锚点 + 登录；一处 `border-[#c9c2ae]`（原型低频，可接受） | — |
| 2 | Hero | — | 同上 | 过 | 过 | 过 | `text-display` + 徽章胶囊 + radial-gradient | — |
| 3 | 四环节 | — | 同上 `#landing-features` | 过 | 过 | 过 | 01–04 文案与四卡齐全 | — |
| 4 | 技术 | — | 同上 `#landing-tech` | 过 | 过 | 过 | 暖炭底 + 三卡 | — |
| 5 | 价格 + CTA | — | 同上 `#landing-price` | 过 | 过 | 过 | 三档价卡 + CTA→登录 | — |
| 6 | 侧边栏 | — | `Sidebar.tsx` | 过 | 过 | 偏 | 七项导航/额度/头像齐；缺原型「新账号视角（演示）」开关 | 7 |
| 7 | 主区域 | — | `AppLayout.tsx` | 过 | 过 | 过 | `h-screen` + 216 侧栏 + 主区 `px-10 py-8` 滚动 | — |
| 8 | 工作台 | `isHome` | `Workbench.tsx` `/workbench` | 过 | 过 | 过 | 双态 homeNew/homeNormal；指标由 cards/scripts 聚合；今日选题取 open 前 3 + 空态；知识空白条无 API 未做（接受，见 backlog） | — |
| 9 | 个人中心 | `isProfile` | `Profile.tsx` `/profile` | 过 | 过 | 过 | `text-title`/`paper-*`；完善度 + 双栏 + 换绑 | — |
| 10 | 校准对话 | `isCalib` | `Calibrate.tsx` `/calibrate` | 过 | 过 | 过 | 令牌过线（text-title/body/copy/hint + paper.*，无 text-2xl/sm 冒充、无裸 hex）。功能：三步进度条 + 三步卡 + Step2 人设确认气泡/基本对·不太对胶囊 + Step3 四宫格档案（剥 draft.profile 嵌套层）+ 试试效果对比块（接 /api/profile/sample-opening，失败静默隐藏）齐；草稿不再 JSON.stringify | — |
| 11 | 账号定位 | `isPos` | `Positioning.tsx` `/positioning` | 过 | 过 | 过 | 令牌过。功能：空态三步+档案/支柱有；右侧「建库引导对话回放」接 /api/profile/interview/history（confirm 时 turns 入库 _interview_turns，不打 AI；未校准/旧档案降级占位） | — |
| 12 | 选题库 | `isTopics` | `Topics.tsx` `/topics` | 过 | 过 | 过 | 空态双 CTA + 列表「生成文案」→`/create?topic=` | — |
| 13 | 文案创作 | `isCreate` | `Create.tsx` `/create`（拆 `create/` 子组件） | 过 | 过 | 过 | 自由 textarea+时长芯片(真传后端控篇幅)+三平台 Tab(切换重生)+逐句编辑(保留真 API)+查重黄条(dedupWarnScriptId)+采纳/换个角度/复制全文+引用侧栏+历史稿件；内联下划线引用无 API 未做（接受） | — |
| 14 | 对标拆解 | `isBench` | `Analyze.tsx` `/analyze` | 过 | 不过 | 偏 | 令牌：`text-2xl`/`text-sm`。功能：拆账号/拆视频 API+轮询+TOP20 列表+三层 `FieldBlock` 有；缺原型①「画像对比」三列 grid（对标 vs 你）及编号卡片化 ②③④ 布局 | **3** |
| 15 | 知识库 | `isKb` | `KB.tsx` `/kb` | 过 | 不过 | 偏 | 令牌：`text-2xl/sm/xs` + 裸 hex。功能：A/B/C tab CRUD + 引用保护有；非原型分层三列网格，无「+对话补卡」/缺卡提醒等 | **4** |
| 16 | 历史稿件 | `isHistory` | `Review.tsx` `/review` | 过 | 不过 | 偏 | UI 标题现为「复盘」应为「发布复盘」。令牌：`text-2xl/sm` + 裸 hex。功能：采用→登记→填数→归因/周卡有；布局非原型表头网格+行内动作 | **5** |

## 范围外

| 项 | 说明 |
|---|---|
| `Login.tsx` `/login` + `LoginOnboarding.tsx` | 原型登录对话框内嵌两步（在第 387 行内嵌源码，extract-prototype.mjs 未切成独立 section，故矩阵 16 段无此页）：`loginStep1` 手机号+验证码表单（`Login.tsx`，旧式 `text-3xl/sm` + 裸 hex，未令牌化——认证门，低优）；`loginStep2` 新用户开通额度引导（`LoginOnboarding.tsx`，`isNew` 后展示，令牌过线 ✅，QR 花纹走 `index.css` `.qr-placeholder`）。上线前换真二维码、改微信号占位 |
| `RechargeDialog.tsx`（全局弹窗，非路由） | 原型 `{{ rechargeModal }}` 块（第 387 行内嵌，未切独立 section）。触发：侧边栏「联系我充值」/ 工作台「查看二维码」→ `useRechargeStore.open()`，AppLayout 单实例挂载。令牌过线 ✅：380px 定宽 + 14px 圆角（`rounded-soft`）+ 无边框 + `shadow-modal`；说明「网站暂不支持在线支付」+ 备注手机尾号（动态 `me.phone` 后 4 位）；微信二维码占位 + 微信号 + 三个静态 chip（50条/¥49、150条/¥129 高亮、拆账号1次=10条）+ 单「知道了」次要按钮。无在线支付，站长手动开通。上线前换真二维码、改微信号占位 |
| Admin（`/admin*`） | 另有 `prototypes/随口说后台管理原型-admin.html`；**本期不评** |

## 建议施工 backlog（按建议序）

1. ~~**工作台** — 补 `homeNew` / `homeNormal` 双态 + 令牌化（登录后第一屏）~~ ✅ 完成（双态 + 令牌过线；知识空白条无 API 延期）
2. ~~**文案创作** — 令牌化 + 对齐原型选题区/平台态/查重等缺失块（按后端是否已有字段裁）~~ ✅ 完成（拆 `create/` 子组件；时长跨仓真传；三平台 Tab+查重 dedupWarnScriptId+逐句+采纳/换个角度/复制；内联下划线引用无 API 延期）
3. **对标拆解** — 结果区改原型①对比表 + 编号块；去掉纯 FieldBlock 堆叠感
4. **知识库** — 令牌化 + 分层网格 / 补卡提醒（能接 API 的先接）
5. **发布复盘** — 标题与表格布局 + 令牌化
6. ~~**校准对话** — 三步进度与档案卡 UI + 令牌化~~ ✅ 完成（三步进度/三步卡/四宫格 + 试试效果对比块接 sample-opening 端点；令牌过线）
7. **侧边栏** — 「新账号视角」演示开关（产品仍要才做）
8. ~~**账号定位** — 对话回放（依赖后端历史 API；无 API 则 gap 保持「偏」）~~ ✅ 完成（回放走 confirm 入库的 _interview_turns，不经 AI；aside 文案+气泡对齐原型）

已过线（落地页五段、主区域、个人中心、选题库）：**维持**，不占主序；发现回归再开单。

## 维护

- 改原型 HTML 后：`node scripts/extract-prototype.mjs && node scripts/prototype-tokens.mjs`，再回头改本表对应行。
- 某段令牌/功能修到过线：改本表单元格，并更新「建议序」为 `—`。
- 不要把本表的「不过/偏」写回 `SECTIONS.md`——那张表只回答有没有文件。
