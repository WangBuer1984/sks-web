# 原型对齐 Gap（C 端）

> **状态**：2026-08-16 已按锁定原型 `07191700` 对齐 React（Landing / 工作台 / 创作右栏人设 / 校准回跳）。矩阵里仍「偏」的主要是对标拆解视频文案详情态（范围外）。
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
| 3 | 四环节 | — | 同上 `#landing-features` | 过 | 过 | 过 | 01–04 已按锁定原型：选题从三处来 / 可追溯 / 点复盘抓数；无热点监控、事实卡、三平台 | — |
| 4 | 技术 | — | 同上 `#landing-tech` | 过 | 过 | 过 | 知识库卡已改「定位档案 + 口播文案、整篇检索、参考可追溯」 | — |
| 5 | 价格 + CTA | — | 同上 `#landing-price` | 过 | 过 | 过 | 三档价卡 + CTA→登录 | — |
| 6 | 侧边栏 | — | `Sidebar.tsx` | 过 | 过 | 过 | 七项导航/额度/头像齐。原型「新账号视角」是演示开关，生产用真实空数据，不做进 React | — |
| 7 | 主区域 | — | `AppLayout.tsx` | 过 | 过 | 过 | `h-screen` + 216 侧栏 + 主区 `px-10 py-8` 滚动 | — |
| 8 | 工作台 | `isHome` | `Workbench.tsx` `/workbench` | 过 | 过 | 过 | 双态；三数字=知识库内容/待用选题/本周已采用；无最近内容/待复盘；三步卡写明换角度扣 1 条 | — |
| 9 | 个人中心 | `isProfile` | `Profile.tsx` `/profile` | 过 | 过 | 过 | `text-title`/`paper-*`；完善度 + 双栏 + 换绑 | — |
| 10 | 校准对话 | `isCalib` | `Calibrate.tsx` `/calibrate` | 过 | 过 | 过 | 三步齐；中途「退出不保存」回定位页；完成后回 `/positioning`；FAQ 默认不勾 | — |
| 11 | 账号定位 | `isPos` | `Positioning.tsx` `/positioning` | 过 | 过 | 过 | 七字段唯一档案 + FAQ 维护/排序/生成选题；创作页 VoicePanel 读写同一对象，取消不保存 | — |
| 12 | 选题库 | `isTopics` | `Topics.tsx` `/topics` | 过 | 过 | 过 | 已去掉「拉取今日热点」；FAQ 来源显示快照与「原问答已删除」 | — |
| 13 | 文案创作 | `isCreate` | `Create.tsx` `/create`（拆 `create/` 子组件） | 过 | 过 | 过 | 常驻两栏：右栏人设声音 + 参考（生成前占位）；采用写明平台；`?content=` 主按钮「保存回知识库」 | — |
| 14 | 对标拆解 | `isBench` | `Analyze.tsx` `/analyze`（拆 `analyze/`） | 过 | 过 | 偏 | 两 Tab；拆视频同框 URL/文案分流；空态/pulse+进度条；①画像对比（API 画像+`getActiveProfile`）②TOP 表头网格+展开/深拆只读/仿写→`createTopic`→`/create?topic=` ③规律条或原文 ④迁移卡+存选题；无假演示结果。**缺**：原型 2026-08-15 已改成「视频文案详情态」——结果区 B 布局（分析区两栏+右栏 sticky、文案全文全宽沉底折叠）、TOP 清单「深拆 →」跳拆视频页并预填链接；React 侧仍是深拆同页展开、结果区无文案全文 | 9 |
| 15 | 知识库 | `isKb` | `KB.tsx` `/kb` | 过 | 过 | 过 | 内容底仓：来源/状态筛选、Markdown 新建、任意来源可登记、多发布记录 | — |
| 16 | 历史稿件 | `isHistory` | `Review.tsx` `/review` | 过 | 过 | 过 | 登记只存链接、点复盘抓数、手动周报；待发布派生自无记录内容；已去未采用反馈 | — |

## 范围外

| 项 | 说明 |
|---|---|
| `Login.tsx` `/login` + `LoginOnboarding.tsx` | 原型登录对话框内嵌两步（在第 387 行内嵌源码，extract-prototype.mjs 未切成独立 section，故矩阵 16 段无此页）：`loginStep1` 手机号+验证码表单（`Login.tsx`，旧式 `text-3xl/sm` + 裸 hex，未令牌化——认证门，低优）；`loginStep2` 新用户开通额度引导（`LoginOnboarding.tsx`，`isNew` 后展示，令牌过线 ✅，QR 花纹走 `index.css` `.qr-placeholder`）。上线前换真二维码、改微信号占位 |
| `RechargeDialog.tsx`（全局弹窗，非路由） | 原型 `{{ rechargeModal }}` 块（第 387 行内嵌，未切独立 section）。触发：侧边栏「联系我充值」/ 工作台「查看二维码」→ `useRechargeStore.open()`，AppLayout 单实例挂载。令牌过线 ✅：380px 定宽 + 14px 圆角（`rounded-soft`）+ 无边框 + `shadow-modal`；说明「网站暂不支持在线支付」+ 备注手机尾号（动态 `me.phone` 后 4 位）；微信二维码占位 + 微信号 + 三个静态 chip（50条/¥49、150条/¥129 高亮、拆账号1次=10条）+ 单「知道了」次要按钮。无在线支付，站长手动开通。上线前换真二维码、改微信号占位 |
| Admin（`/admin*`） | 另有 `prototypes/随口说后台管理原型-admin.html`；**本期不评** |

## 建议施工 backlog（按建议序）

1. ~~**工作台** — 补 `homeNew` / `homeNormal` 双态 + 令牌化（登录后第一屏）~~ ✅ 完成（双态 + 令牌过线；知识空白条无 API 延期）
2. ~~**文案创作** — 令牌化 + 对齐原型选题区/平台态/查重等缺失块（按后端是否已有字段裁）~~ ✅ 完成（拆 `create/` 子组件；时长跨仓真传；三平台 Tab+查重 dedupWarnScriptId+逐句+采纳/换个角度/复制；内联下划线引用无 API 延期）
3. ~~**对标拆解** — 结果区改原型①对比表 + 编号块；去掉纯 FieldBlock 堆叠感~~ ✅ 完成（两 Tab + `analyze/` 子组件；深拆只读/仿写跳转；无假演示结果）
4. ~~**知识库** — 令牌化 + 分层网格 / 补卡提醒（能接 API 的先接）~~ ✅ 完成（去 tab 改三层三列网格 + 令牌化；补卡/缺卡/活卡率/C stat 无 API deferred 占位；C 层 CRUD 移除）
5. ~~**发布复盘** — 标题与表格布局 + 令牌化~~ ✅ 完成（9 列表格 + 真五码 + track 自动判态 + 选题 JOIN title；砍 /play；令牌化）
6. ~~**校准对话** — 三步进度与档案卡 UI + 令牌化~~ ✅ 完成（三步进度/三步卡/四宫格 + 试试效果对比块接 sample-opening 端点；令牌过线）
7. **侧边栏** — 「新账号视角」是原型演示开关，生产环境用真实空数据，**不做进 React**
8. ~~**账号定位** — 对话回放（依赖后端历史 API；无 API 则 gap 保持「偏」）~~ ✅ 完成（回放走 confirm 入库的 _interview_turns，不经 AI；aside 文案+气泡对齐原型）
9. **对标拆解** — 视频文案详情态：`/analyze?video=<明细id>` 把拆视频页填满（结果区 B 布局 + 文案全文折叠 + 深拆/看文案跳转 + 已存入选题库终态）。spec/plan 见 `sks-server/docs/superpowers/{specs,plans}/2026-08-15-video-transcript-detail*.md`；交互基准见 `prototypes/随口说原型-视频文案详情.html`（可点，纯手写）

以下 10–13 已按锁定原型对齐。

10. ~~**知识库**~~ ✅ 内容底仓；来源与状态正交；多发布记录
11. ~~**文案创作 + 账号定位**~~ ✅ 七字段档案、FAQ、双平台独立版本、右栏人设、采用入库
12. ~~**发布复盘 + 选题库 + 工作台**~~ ✅ 登记/复盘分离、手动周报、去热点与未采用反馈
13. ~~**Landing**~~ ✅ 卖点去「热点监控 / 事实可溯源 / 自动追踪」

已过线（落地页顶栏/Hero/价格、主区域、个人中心）：**维持**，不占主序；发现回归再开单。

## 维护

- C 端视觉基准改回 `随口说原型-07191700.html`：手改 `extracted/full.html` 后 `node scripts/repack-prototype.mjs` 写回。`随口说原型-2026-08-16.html` 已作废。Admin 原型仍只读。
- 现有 HTML 是设计工具导出件，第 387 行保存 JSON 转义源码；此前 D1–D17 的历史手改会被重新导出覆盖，因此本 Gap 与产品规格才是后续施工权威，不应反向把旧 HTML 当完整需求。
- 改完 JS 逻辑（第 387 行内嵌的 `<script type="text/x-dc">`）后值得跑一次自检：把该 script 体抠出来加 `class DCLogic{}` 桩 `node --check`，再 `new Component().renderVals()` 看 `kbList`/`historyList`/`citedList` 字段是否齐全——原型没有类型检查，漏一个 `{{ 绑定 }}` 只会静默渲染成空白。
- 文案全文折叠用 `details/summary` + `.ptFold*` CSS，不依赖导出运行时的 `sc-camel-on-click` 事件绑定；这也是原型里唯一的 class 选择器（`prototype-tokens.mjs` 只扫 inline style，不受影响）。
- 某段令牌/功能修到过线：改本表单元格，并更新「建议序」为 `—`。
- 不要把本表的「不过/偏」写回 `SECTIONS.md`——那张表只回答有没有文件。
