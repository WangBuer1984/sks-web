# 原型分段索引（自动生成，勿手改）

由 `node scripts/extract-prototype.mjs` 生成。改原型后重跑本脚本。

源文件：`prototypes/随口说原型-07191700.html`（页面源码在第 387 行的 JSON 字符串里）
还原后：5882 行；其中前约 4080 行是 505 条 `@font-face` 内嵌字体，App 标记从 4084 行起。

`<sc-if value="{{ isXxx }}">` 是原型的显隐条件，等价于一份路由/状态表——建 React 路由时可直接对照。

| # | 段 | 显隐条件 | 包裹标签 | 原文行 | 行数 | 分段文件 | 现有 React 实现 |
|---|---|---|---|---|---|---|---|
| 1 | 顶栏 | — | `div` | 4092–4106 | 14 | `sections/01-顶栏.html` | src/pages/Landing.tsx  (/) —— Landing 内顶栏区块 |
| 2 | Hero | — | `div` | 4107–4117 | 10 | `sections/02-Hero.html` | src/pages/Landing.tsx  (/) —— Landing 内 Hero 区块 |
| 3 | 四环节 | — | `div` | 4118–4146 | 28 | `sections/03-四环节.html` | src/pages/Landing.tsx  (/) —— Landing 内 #landing-features |
| 4 | 技术 | — | `div` | 4147–4181 | 34 | `sections/04-技术.html` | src/pages/Landing.tsx  (/) —— Landing 内 #landing-tech |
| 5 | 价格 + CTA | — | `div` | 4182–4206 | 24 | `sections/05-价格-+-CTA.html` | src/pages/Landing.tsx  (/) —— Landing 内 #landing-price |
| 6 | 侧边栏 | — | `div` | 4247–4279 | 32 | `sections/06-侧边栏.html` | src/components/Sidebar.tsx  （AppLayout 挂载） |
| 7 | 主区域（容器） | — | `div` | 4281–5147 | 3 | `sections/07-主区域.html` | src/components/AppLayout.tsx  （layout route） |
| 8 | 工作台 | `isHome` | `sc-if` | 4284–4373 | 89 | `sections/08-工作台.html` | src/pages/Workbench.tsx  (/workbench) |
| 9 | 个人中心 | `isProfile` | `sc-if` | 4375–4431 | 56 | `sections/09-个人中心.html` | src/pages/Profile.tsx  (/profile) |
| 10 | 校准对话 | `isCalib` | `sc-if` | 4433–4515 | 82 | `sections/10-校准对话.html` | src/pages/Calibrate.tsx  (/calibrate) |
| 11 | 账号定位 | `isPos` | `sc-if` | 4517–4626 | 109 | `sections/11-账号定位.html` | src/pages/Positioning.tsx  (/positioning) |
| 12 | 选题库 | `isTopics` | `sc-if` | 4628–4659 | 31 | `sections/12-选题库.html` | src/pages/Topics.tsx  (/topics) |
| 13 | 文案创作 | `isCreate` | `sc-if` | 4661–4797 | 136 | `sections/13-文案创作.html` | src/pages/Create.tsx  (/create) |
| 14 | 对标拆解 | `isBench` | `sc-if` | 4799–4990 | 191 | `sections/14-对标拆解.html` | src/pages/Analyze.tsx  (/analyze) |
| 15 | 知识库 | `isKb` | `sc-if` | 4992–5062 | 70 | `sections/15-知识库.html` | src/pages/KB.tsx  (/kb) |
| 16 | 历史稿件 | `isHistory` | `sc-if` | 5064–5146 | 82 | `sections/16-历史稿件.html` | src/pages/Review.tsx  (/review) —— UI 标题应对齐「发布复盘」 |

> 本表只回答「段 ↔ 文件/路由」。令牌保真与功能覆盖见 [`../PROTOTYPE_GAP.md`](../PROTOTYPE_GAP.md)（尺子：令牌过线）。
