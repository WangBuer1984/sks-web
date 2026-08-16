# C 端全站产品原型 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 手写一份单文件可点桌面 HTML（`sks-web/prototypes/随口说原型-2026-08-16.html`），顶上「原型审查条」能切到规格 §5 列出的每一格「页 × 状态」，把 C 端全站空/加载/失败/成功/边界态点完，作为锁定后改 React 与 D18–D21 规格的视觉与交互真相。

**Architecture:** 一个 HTML 文件，内含 CSS（纸感色板 + 侧栏布局）+ 少量 JS 状态机。状态机持有 `{page, state, stage}`，按 `page` 路由到各页 `render` 函数、按 `state` 切该页内部态、按 `stage`（账号阶段）切换全站演示数据集。审查条三个下拉（页面 / 状态 / 账号阶段）驱动状态机，状态下拉的选项由该页注册的 §5 状态枚举动态填充。无 API、无构建器、无自动测试——验收 = 用审查条逐格点过 §5。

**Tech Stack:** 手写 HTML + CSS（原生，不引框架）+ 原生 JS（状态机 + innerHTML 路由）。不接 Vite / React / Tailwind，不当设计工具再导出。

## Global Constraints

> 每个任务的隐性前置，全部照抄自规格 `sks-web/docs/superpowers/specs/2026-08-16-c-end-prototype-design.md`（下称「规格」）。

- **纸感色板**：底 `#f4f1e9`、主色 `#8a5a2b`、侧栏暖炭（约 `#3a2f29`）、标题 `Noto Serif SC`。全文 CSS 变量集中在 `:root`，正文不堆半像素字号。
- **只锁桌面**（约 1280+）：主区最大宽度 880–1120；侧栏固定 216px。不做响应式、不做手机。
- **单文件**：全部产物写在 `随口说原型-2026-08-16.html` 一个文件里；不拆 partial、不引外部 CSS/JS、不引字体 CDN（`Noto Serif SC` 用 `font-family` 栈，系统无则降级 serif）。
- **不接 API、不引构建器**：所有数据是写死在文件里的中文演示数据，像真实口播账号，不用 lorem。按钮点击只切状态、弹确认条，不发请求。
- **审查条不是产品**：最顶上一条 36–40px 深底细条 +「原型审查 · 不出现在正式产品里」字样，左切页 / 中切状态 / 右切账号阶段。React 对齐时丢掉。
- **无流式输出**：加载/生成中用阶段文案或脉冲条，不画骨架屏迷宫。
- **危险操作用确认条**：删除内容、退出校准、换绑等用自定义确认条，**禁用** 浏览器原生 `alert/confirm/prompt`。
- **§5 是验收表**：规格 §5 每一格都必须能从审查条切到并看到对应界面，缺一格不算做完。本计划每页任务的最后一步就是逐格点过。
- **不改旧文件**：`prototypes/随口说原型-07191700.html`、`随口说原型-视频文案详情.html`、`prototypes/extracted/`、`prototypes/PROTOTYPE_GAP.md` 在本 HTML 锁定前一律不碰（规格 §7）。本计划只新建一个文件。
- **不画视频文案详情态**：拆解页深拆在本页展开四字段，不跳详情态、不预填 `/analyze?video=`（规格 §4.9）。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `sks-web/prototypes/随口说原型-2026-08-16.html`（Create，唯一产物） | 全部 HTML + CSS + JS 状态机 + 演示数据。按任务分段往上长，每任务结束文件都能在浏览器打开且已实现部分可点。 |

无其它文件。无测试文件——验收靠审查条手点 §5。

## 状态机契约（所有页任务共用的接口）

Task 1 落地以下契约，后续每页任务 **只** 通过 `register(...)` 接入，不另起状态逻辑：

```js
// 全局状态
const STATE = { page: 'landing', state: 'default', stage: 'active' };

// 页注册表：page -> { states: string[], render: (s)=>string }
const REGISTRY = {};
function register(page, states, render) { REGISTRY[page] = { states, render }; }

// 三根控制线，审查条调用
function setPage(p)  { STATE.page = p; STATE.state = REGISTRY[p]?.states[0] ?? 'default'; render(); }
function setState(s) { STATE.state = s; render(); }
function setStage(g) { STATE.stage = g; render(); }

// 渲染：审查条 + 侧栏壳（登录后） + 当前页
function render() {
  const reg = REGISTRY[STATE.page];
  const body = reg ? reg.render(STATE) : fallback(STATE);
  document.getElementById('app').innerHTML = shell(STATE, body);
  syncBar();              // 审查条三下拉回填当前值 + 重填状态下拉选项
}
```

- 页 `render(s)` 返回该页**主区 innerHTML**（不含审查条、不含侧栏壳——壳由 `shell()` 统一加）。
- `shell(state, body)`：未登录页（landing/login/recharge）只返回 `body`（顶栏在 landing 自己画，登录/充值是对话框叠层）；登录后页返回 `<aside 侧栏 216px> + <main 主区>body</main>`。
- `fallback(STATE)`：返回一段「该页/状态尚未实现」的诚实占位（深底虚线框 + 文案），是状态机对未注册页的真实回退，不是产品占位。
- 演示数据统一放 `DEMO` 对象（Task 1 落账号核心，各页任务往里补自己的列表切片）。

**`page` 枚举**（12 项，对应 §5）：`landing` / `login` / `recharge` / `workbench` / `calibrate` / `account-positioning` / `account-profile` / `topics` / `create` / `analyze` / `kb` / `review`。

**`stage` 枚举**（§2.4，4 项）：`new`（刚开通）/ `calibrated`（已校准没写过）/ `active`（使用中）/ `exhausted`（额度用尽）。stage 决定各页演示数据集与默认态；显式 `state` 选择永远优先（规格 §5 末行）。

---

## Task 1: 骨架 + 审查条 + 状态机 + 落地页路由占位

**Files:**
- Create: `sks-web/prototypes/随口说原型-2026-08-16.html`

**Interfaces:**
- Produces: `STATE` / `REGISTRY` / `register` / `setPage` / `setState` / `setStage` / `render` / `shell` / `fallback` / `syncBar`（见上「状态机契约」）；`DEMO` 对象骨架（账号核心 + 定位七字段，列表切片留给各页任务）；`:root` CSS 变量全表；审查条 DOM + 三个下拉的填充逻辑；落地页 `register('landing', ['default'], renderLanding)` 但 `renderLanding` 先只画 Hero + 顶栏（完整落地页在 Task 2）。

- [ ] **Step 1: 写文件头 + CSS 变量 + 审查条 + app 根**

新建文件，写入：`<!DOCTYPE html>` + `<meta charset=utf-8>` + `<title>随口说 · C 端原型（审查）</title>` + `<style>`。`:root` 内集中：

```css
:root{
  --paper:#f4f1e9; --ink:#8a5a2b; --ink-soft:#b07d4e;
  --charcoal:#2a2421; --sidebar:#3a2f29; --sidebar-ink:#e9ddc9;
  --line:#d9cfb8; --card:#fbf8f1; --danger:#9c3d3d; --ok:#5a7a4a;
  --serif:"Noto Serif SC","Songti SC",serif;
  --sans:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;
  --r-card:12px; --maxw:1040px;
}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--paper);color:var(--charcoal);font:15px/1.6 var(--sans)}
h1,h2,h3{font-family:var(--serif);color:var(--ink)}
/* 审查条 */
.review-bar{position:sticky;top:0;z-index:50;display:flex;gap:12px;align-items:center;
  height:40px;padding:0 16px;background:#231c19;color:#e9ddc9;
  border-bottom:1px dashed #8a5a2b;font-size:13px}
.review-bar .tag{font-family:var(--serif);opacity:.9}
.review-bar select{background:#231c19;color:#e9ddc9;border:1px solid #5c4636;padding:3px 6px;border-radius:4px;font-size:12px}
/* 侧栏壳 */
.app-shell{display:flex;min-height:calc(100vh - 40px)}
.sidebar{width:216px;background:var(--sidebar);color:var(--sidebar-ink);padding:18px 0;flex-shrink:0}
.sidebar .brand{font-family:var(--serif);font-size:20px;padding:0 18px 18px;border-bottom:1px solid #4a3b33}
.sidebar nav a{display:block;padding:10px 18px;color:var(--sidebar-ink);cursor:pointer}
.sidebar nav a.on{background:rgba(255,255,255,.06);border-left:3px solid var(--ink-soft)}
.main{flex:1;overflow:auto;padding:32px 40px}
.main-inner{max-width:var(--maxw);margin:0 auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r-card);padding:20px}
.btn{display:inline-block;padding:8px 16px;border-radius:8px;border:1px solid var(--ink);background:var(--ink);color:#fff;cursor:pointer;font:inherit}
.btn.ghost{background:transparent;color:var(--ink)}
.btn.danger{background:var(--danger);border-color:var(--danger)}
/* 脉冲加载条 */
.pulse{height:6px;background:var(--line);border-radius:3px;overflow:hidden}
.pulse i{display:block;height:100%;width:40%;background:var(--ink-soft);animation:pulse 1.1s infinite}
@keyframes pulse{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
/* 诚实占位 fallback */
.fallback{margin:40px auto;max-width:560px;padding:24px;border:1px dashed var(--ink-soft);border-radius:var(--r-card);background:repeating-linear-gradient(45deg,#fbf8f1 0 10px,#f4f1e9 10px 20px)}
```

审查条 DOM（在 `<body>` 顶部）：

```html
<div class="review-bar">
  <span class="tag">原型审查 · 不会出现在正式产品里</span>
  <select id="bar-page"></select>
  <select id="bar-state"></select>
  <span>账号阶段</span>
  <select id="bar-stage"></select>
</div>
<div id="app"></div>
```

- [ ] **Step 2: 写状态机 JS + DEMO 账号核心 + shell/fallback/syncBar**

```js
const STATE = { page: 'landing', state: 'default', stage: 'active' };
const REGISTRY = {};
function register(page, states, render) { REGISTRY[page] = { states, render }; }

const PAGES = [
  ['landing','落地页'],['login','登录'],['recharge','充值'],
  ['workbench','工作台'],['calibrate','校准'],
  ['account-positioning','账号 · 定位'],['account-profile','账号 · 资料'],
  ['topics','选题库'],['create','文案创作'],['analyze','对标拆解'],
  ['kb','知识库'],['review','发布复盘']
];
const STAGES = [['new','刚开通'],['calibrated','已校准没写过'],['active','使用中'],['exhausted','额度用尽']];

// 演示账号核心（定位七字段 + 资料），各页任务往 DEMO 补列表切片
const DEMO = {
  profile: {
    人设:'说真话的工厂老板，机械加工二十年', 目标人群:'30–45 岁制造业老板',
    差异化:'工厂直营、不贬同行', 转化路径:'主页留资 → 加微信 → 到店',
    口吻:'直、带点狠、不端着', 红线:'不贬同行、不报虚价', 内容支柱:'4:2:2:2（行业 / 设备 / 老板日常 / 转化）'
  },
  account: { nickname:'老李说机械', gender:'男', age:43, city:'东莞',
    industry:'机械加工', identity:'工厂老板', style:'口播出镜', weeklyGoal:'每周 3 条' },
  faq: [
    { q:'你设备为什么比别人便宜三成？', a:'工厂直营没有中间商，加上我量大议价。' },
    { q:'便宜的会不会偷工减料？', a:'材料牌号、公差我全写在合同里，到货可复检。' }
  ]
};

function fallback(s){ return `<div class="fallback"><h3>尚未实现</h3><p>page=<code>${s.page}</code> state=<code>${s.state}</code></p><p>该格在后续任务接入。</p></div>`; }

// 登录后页才套侧栏壳；未登录页裸 body
const AUTHED = new Set(['workbench','calibrate','account-positioning','account-profile','topics','create','analyze','kb','review']);
function sidebarHTML(s){
  const on = p => s.page===p ? ' class="on"' : '';
  return `<aside class="sidebar"><div class="brand">随口说</div><nav>
    <a${on('workbench')} onclick="setPage('workbench')">工作台</a>
    <a${on('account-positioning')} onclick="setPage('account-positioning')">账号</a>
    <a${on('topics')} onclick="setPage('topics')">选题库</a>
    <a${on('create')} onclick="setPage('create')">文案创作</a>
    <a${on('analyze')} onclick="setPage('analyze')">对标拆解</a>
    <a${on('kb')} onclick="setPage('kb')">知识库</a>
    <a${on('review')} onclick="setPage('review')">发布复盘</a>
  </nav><div style="margin-top:auto;padding:14px 18px;border-top:1px solid #4a3b33">
    <div class="card" style="background:rgba(255,255,255,.04);color:var(--sidebar-ink);padding:12px">
      <div>剩余 <b>${s.stage==='exhausted'?0:86}</b> 条</div><div style="font-size:12px;opacity:.7">本月 150 条</div>
      <button class="btn ghost" style="margin-top:8px;width:100%" onclick="setPage('recharge')">充值</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:12px;cursor:pointer" onclick="setPage('account-profile')">
      <span style="width:28px;height:28px;border-radius:50%;background:var(--ink-soft)"></span>
      <span style="font-size:13px">${DEMO.account.nickname}</span>
    </div>
    <a style="display:block;margin-top:10px;font-size:12px;opacity:.6;cursor:pointer" onclick="setPage('landing')">退出登录</a>
  </div></aside>`;
}
function shell(s, body){
  if(!AUTHED.has(s.page)) return body;            // 落地页/登录/充值不套壳
  return `<div class="app-shell">${sidebarHTML(s)}<main class="main"><div class="main-inner">${body}</div></main></div>`;
}
function render(){
  const reg = REGISTRY[STATE.page];
  const body = reg ? reg.render(STATE) : fallback(STATE);
  document.getElementById('app').innerHTML = shell(STATE, body);
  syncBar();
}
function syncBar(){
  const sp = document.getElementById('bar-page');
  sp.innerHTML = PAGES.map(([k,n])=>`<option value="${k}"${STATE.page===k?' selected':''}>${n}</option>`).join('');
  const reg = REGISTRY[STATE.page];
  const ss = document.getElementById('bar-state');
  const states = reg ? reg.states : ['default'];
  ss.innerHTML = states.map(st=>`<option value="${st}"${STATE.state===st?' selected':''}>${st}</option>`).join('');
  const sg = document.getElementById('bar-stage');
  sg.innerHTML = STAGES.map(([k,n])=>`<option value="${k}"${STATE.stage===k?' selected':''}>${n}</option>`).join('');
}
document.getElementById('bar-page').addEventListener('change',e=>setPage(e.target.value));
document.getElementById('bar-state').addEventListener('change',e=>setState(e.target.value));
document.getElementById('bar-stage').addEventListener('change',e=>setStage(e.target.value));
```

- [ ] **Step 3: 落地页最小 Hero 占位 + 启动**

```js
function renderLanding(s){
  return `<header style="display:flex;justify-content:space-between;align-items:center;padding:18px 40px">
    <span style="font-family:var(--serif);font-size:24px;color:var(--ink)">随口说</span>
    <button class="btn" onclick="setPage('login')">登录</button>
  </header>
  <section style="text-align:center;padding:80px 40px">
    <h1 style="font-size:40px">把口播这件事，说清楚再做</h1>
    <p style="margin:16px 0 24px;color:#6b5a45">完整落地页在 Task 2 画。</p>
    <button class="btn" onclick="setPage('login')">开始用</button>
  </section>`;
}
register('landing', ['default'], renderLanding);
render();
```

- [ ] **Step 4: 浏览器打开验收**

在浏览器打开 `随口说原型-2026-08-16.html`。确认：
- 审查条三下拉可见，「原型审查」字样可见。
- 页面下拉含 12 项；状态下拉随页变；账号阶段含 4 项。
- 切到任意未实现页（如工作台）→ 显示诚实占位（虚线纸边 +「尚未实现」），不是白屏。
- 切回落地页 → Hero + 登录按钮可见；点登录按钮 → 审查条页面跳到 `login`（仍占位）。
- 切到任意登录后页 → 左侧栏 216px 暖炭底 + 七项 + 额度卡 + 头像 + 退出可见。

- [ ] **Step 5: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): C 端原型骨架 + 审查条 + 状态机

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 落地页（默认）+ 登录对话框（四态）+ 充值对话框

**Files:**
- Modify: `随口说原型-2026-08-16.html`（替换 Task 1 的 `renderLanding`；新增 `renderLogin` / `renderRecharge`；`DEMO` 加 `tiers`）。

**Interfaces:**
- Consumes: Task 1 状态机契约、`DEMO`。
- Produces: `register('landing', ['default'], renderLanding)`（完整五段）、`register('login', ['填手机','倒计时','验证码错','开通引导'], renderLogin)`、`register('recharge', ['默认说明'], renderRecharge)`；`DEMO.tiers`（充值三档）。
- 对话框是叠在 `body` 上的 `<div class="modal-overlay">`，由 `modal(html)` 辅助函数产出（本任务落到全局，后续登录后页的充值也复用）。

**内容来源**：规格 §4.1（落地页五段 + 四环节 + 技术三卡 + 价格三卡）、§4.2（登录两步、充值对话框）、§3 落地页卖点行。

- [ ] **Step 1: 落地页五段 + `modal()` 辅助**

落 `modal(html)`：返回 `<div class="modal-overlay" onclick="closeModalIfBg(event)">` + 居中 `.modal-card` + `html`，关闭按钮调 `setPage('landing')`（登录/充值对话框的「关闭」=回落地页）。CSS：overlay 半透明纸色 + 居中卡 `--card` 圆角。

`renderLanding` 画规格 §4.1 五段：
1. 顶栏：Logo + 锚点（功能/技术/价格）+ 登录按钮（→ setPage('login')）。
2. Hero：一句标题 + 副标 + CTA（→ 登录）。
3. 四环节：按规格 §4.1 四条文案原样，**不提** 热点监控 / 事实卡 / 小红书 / 三平台。
4. 技术三卡：多模型调度 / 知识库（定位档案 + 口播稿 = 账号大脑，整篇检索、参考可点回原文）/ Skill 工作流，去掉「自动监控」语气。
5. 价格三卡：体验（标「免费」，注「首充送 10 条」）/ 150 条 ¥129 / 拆账号 = 10 条额度（消耗说明非售价）。CTA → 登录。
   - 规格明确：落地页价格与充值档**不是同一套 SKU**，体验≠50 条 ¥49 档；只有 150 条 ¥129 两页相同。别合成。

- [ ] **Step 2: 登录对话框四态**

`DEMO.tiers = [['50 条','¥49'],['150 条','¥129'],['拆账号 1 次','10 条']]`（中档高亮，见 §4.2）。

`renderLogin(s)` 四态：
- `填手机`：手机号输入 + 「获取验证码」按钮（→ setState('倒计时')）。
- `倒计时`：同上 + 验证码输入 + 60s 倒计时文案 + 「重新获取」。
- `验证码错`：验证码输入下方红字「验证码错误」+ 可重输。
- `开通引导`：规格 §4.2「新用户看到开通额度引导」——一段欢迎 + 额度说明（体验首充送 10 条）+ 主按钮「进工作台」（→ setPage('workbench')）。老用户路径在本态不另画（规格 §4.2：老用户直接进工作台 = 直接切工作台页即可）。

对话框顶部画「登录」标题；关闭回落地页。

- [ ] **Step 3: 充值对话框**

`renderRecharge(s)` 默认说明态（规格 §4.2）：「联系我开通」+ 备注手机尾号（如 `***6789`）+ 微信二维码占位（一个灰底方块写「微信二维码占位」）+ 三档芯片（`DEMO.tiers`，¥129 高亮）+「知道了」按钮（关闭回落地页或工作台）。**不画** 在线支付流程（规格 P8 / §9）。

- [ ] **Step 4: 浏览器验收 §5 三行**

逐格点审查条：
- 落地页 · 默认：五段全在；四环节不含热点监控/事实卡/小红书/三平台；价格体验卡标「免费 + 首充送 10 条」、拆账号卡是「= 10 条额度」非售价。
- 登录 · 填手机 / 倒计时 / 验证码错 / 开通引导：四态都能切到且界面不同；开通引导「进工作台」按钮真能跳工作台。
- 充值 · 默认说明：三档芯片在，¥129 高亮，无在线支付，「知道了」可关。

- [ ] **Step 5: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 落地页 + 登录四态 + 充值对话框

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 登录后壳侧栏行为 + 工作台（六态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（侧栏已有，本任务补交互 + `renderWorkbench`；`DEMO` 加 `kb`/`topics`/`reviewRecent`/`pendingReview` 切片）。

**Interfaces:**
- Consumes: Task 1 侧栏壳、状态机。
- Produces: `register('workbench', ['刚开通引导','已校准空库','使用中','加载','失败','额度用尽'], renderWorkbench)`；`DEMO.recentContent`（最近 3 篇）、`DEMO.pendingReview`（待复盘）、`DEMO.todays`（今天可以拍）、`DEMO.numbers`（三数字）。
- 侧栏额度卡点「充值」→ `setPage('recharge')`；头像 → `setPage('account-profile')`；退出 → `setPage('landing')`（已在 Task 1 壳里，本任务只确认无误）。

**内容来源**：规格 §4.3、§2.4。

- [ ] **Step 1: `DEMO` 工作台切片**

```js
DEMO.numbers = { kb:24, topics:9, adopted:3 };            // 使用中
DEMO.todays = [
  {type:'FAQ', title:'设备为什么便宜三成', from:'定位高频问答'},
  {type:'对标', title:'某同行 TOP1：开工前先报材料牌号', from:'拆账号存下'},
  {type:'续集', title:'爆款《便宜三成》续集：到货怎么复检', from:'复盘续集'}
];
DEMO.recentContent = [
  {title:'便宜三成不是偷工减料', platform:'抖音', status:'已发布'},
  {title:'合同里写公差这件事', platform:'视频号', status:'未发布'},
  {title:'工厂老板的一天', platform:'抖音', status:'爆款'}
];
DEMO.pendingReview = [
  {title:'材料牌号怎么写进合同', platform:'抖音', link:'v.douyin.com/abc1'},
  {title:'到货复检三步', platform:'视频号', link:'channels/xyz2'}
];
```

- [ ] **Step 2: `renderWorkbench` 六态**

按规格 §4.3：
- `刚开通引导`：问候 + 三步引导（校准定位 → 拆一条对标或确认 FAQ → 去写第一篇），主按钮「开始校准」（→ setPage('calibrate')）。**不出现** 最近内容 / 待复盘。此态由 `stage==='new'` 默认带入，但显式切也成立。
- `已校准空库`：问候 + 三数字全 0 + 「今天可以拍」写「还没有可以拍的」+ 最近内容块占位「还没有」+ 待复盘块占位「还没有」。空也占位（规格 §3 工作台行）。
- `使用中`：问候 + `DEMO.numbers` + `DEMO.todays` 列表 + `DEMO.recentContent` 最近 3 篇 + `DEMO.pendingReview` 待复盘。每篇显示标题/平台/状态徽章。
- `加载`：脉冲条 + 阶段文案「正在拉工作台…」，不画骨架屏迷宫。
- `失败`：一句人话「没拉到工作台」+ 重试按钮（→ setState('使用中')）。
- `额度用尽`：问候 + 三数字仍在 + 生成类入口仍在（「去写一篇」按钮），点了 → setPage('create') 且本原型用 `STATE.state='额度不够'` 表达（规格 §4.3 末行）。侧栏额度卡显示 0 条。

额度大卡**不** 出现在工作台主区，只在侧栏（规格 §4.3 首行）。

- [ ] **Step 3: `stage` 影响默认态**

在 `render()` 路由处或 `renderWorkbench` 入口：`stage==='new'` 且 `state` 未显式选时 → 刚开通引导。实现：`setStage` 后若当前页是工作台且 state 是默认，自动落 `刚开通引导`。显式 setState 永远优先。

- [ ] **Step 4: 浏览器验收 §5 工作台行**

逐格点：刚开通引导 / 已校准空库（数字 0 + 两块「还没有」）/ 使用中 / 加载 / 失败 / 额度用尽。确认额度用尽态的「去写一篇」点了进创作页「额度不够」态。切 stage=刚开通 + 工作台 → 自动落引导。

- [ ] **Step 5: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 工作台六态 + 侧栏额度交互

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 校准（六态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderCalibrate`）。

**Interfaces:**
- Produces: `register('calibrate', ['步骤1','步骤2','步骤3','进行中','失败','完成确认'], renderCalibrate)`。
- 校准是对话框式全屏页（不进侧栏，规格 §2.2），但本原型走独立 `page=calibrate`（审查条可切）；登录后壳侧栏在此页隐藏——在 Task 1 `AUTHED` 集合中**移除** `calibrate`，让它走裸 body 全屏。

**内容来源**：规格 §4.4。

- [ ] **Step 1: 把 calibrate 移出 AUTHED**

Task 1 的 `AUTHED` 集合含 `calibrate`，需改为不含（校准是向导，不套侧栏）。`sed`/手改 `const AUTHED = new Set([...])`，去掉 `'calibrate'`。

- [ ] **Step 2: `renderCalibrate` 六态**

按规格 §4.4 三步 + 进行中/失败/完成：
- `步骤1`：贴主页或作品链接的输入框 + 「下一步」。
- `步骤2`：一问一答界面（AI 提问 + 用户答 + 「不太对」按钮改猜的人设）+ 「下一步」「上一步」。
- `步骤3`：确认七字段档案（用 `DEMO.profile` 预填）+ 勾选要留下的客户问答（默认**全不勾**，规格 §4.4）+ 「完成」。
- `进行中`：阶段进度遮罩（步骤条 + 「正在分析主页…」脉冲），无流式（规格 §4.4 末行）。
- `失败`：一句「分析没成功」+ 重试。
- `完成确认`：「定位档案已保存」+ 主按钮「去账号定位」（→ setPage('account-positioning')）。规格 §4.4：完成后进入账号·定位。

- [ ] **Step 3: 浏览器验收 §5 校准行**

逐格点：步骤1/2/3/进行中/失败/完成确认。确认完成确认「去账号定位」真能跳账号·定位页。中途退出不保存——本原型不验证持久，UI 上「上一步/退出」按钮存在即可。

- [ ] **Step 4: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 校准六态向导

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 账号 · 定位（五态）+ 账号 · 资料（八态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderPositioning` / `renderProfile`；`DEMO` 加 `profileFormDraft` 用于保存失败态演示用户刚改的值）。

**Interfaces:**
- Produces: `register('account-positioning', ['未校准','档案在FAQ空','有FAQ','保存中','保存失败'], renderPositioning)`、`register('account-profile', ['完善度未满','已满','保存中','保存失败','换绑','换绑验证码错','加载','加载失败'], renderProfile)`。
- 两页同属「账号」页两页签；页头画「定位 / 资料」页签切换：定位页签 → `setPage('account-positioning')`，资料页签 → `setPage('account-profile')`。

**内容来源**：规格 §2.3、§4.5、§4.6。

- [ ] **Step 1: 账号页页签头（两 render 共用）**

抽 `accountTabs(active)` 返回 `<nav class="tabs">定位 | 资料</nav>`，active 高亮。两个 render 顶部都先输出它。

- [ ] **Step 2: `renderPositioning` 五态**

按规格 §4.5：
- `未校准`：引导 + 「开始校准」（→ setPage('calibrate)）。
- `档案在FAQ空`：七字段（`DEMO.profile`）只读展示 + 高频问答区空「还没有，从校准里勾选或这里加」。
- `有FAQ`：七字段 + `DEMO.faq` 列表，每条「生成选题」（→ setPage('topics') 且标刚生成，见 Task 6）+ 增删改排序控件（UI 在即可）。
- `保存中`：七字段 + 问答编辑态 + 顶部脉冲条「保存中」。
- `保存失败`：编辑态保留用户刚改的值（用 `DEMO.profileFormDraft` 演示）+ 红字「保存失败」+ 重试。规格 §4.5 末行：失败不回滚。

「AI 不能悄悄改档案」「取消回到打开时样子」——UI 上有取消按钮即可，本原型不验证持久。

- [ ] **Step 3: `renderProfile` 八态**

按规格 §4.6 + §2.3：
- 左：完善度条（只算 5 项：昵称/行业/身份/出镜风格/每周更新目标；性别/年龄/城市不计入，页上写明口径）+ 表单（昵称、性别、年龄、城市、行业、身份、出镜风格三选一、每周更新目标）。
- 右：手机号换绑。
- `完善度未满`：5 项里有缺，完善度条未满，表单可填。
- `已满`：5 项全填，条满。
- `保存中`：脉冲条。
- `保存失败`：红字 + 重试。
- `换绑`：新手机号输入 + 「获取验证码」。
- `换绑验证码错`：红字「验证码错」。
- `加载`：脉冲条「加载资料」。
- `加载失败`：一句人话 + 重试。

- [ ] **Step 4: 浏览器验收 §5 两行**

逐格点账号·定位 5 态 + 账号·资料 8 态。确认两页页签能互切。确认资料完善度口径文字写明「只算 5 项，性别/年龄/城市不计」。

- [ ] **Step 5: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 账号定位五态 + 资料八态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 选题库（六态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderTopics`；`DEMO.topics` 切片）。

**Interfaces:**
- Produces: `register('topics', ['空','加载','失败','有选题','刚从FAQ生成','含原问答已删除'], renderTopics)`。
- 每条「进创作」→ `setPage('create')`。

**内容来源**：规格 §4.7、§3。

- [ ] **Step 1: `DEMO.topics` 切片**

```js
DEMO.topics = [
  {title:'设备为什么便宜三成', from:'定位问答', tag:'原问答已删除'},
  {title:'某同行 TOP1 续：开工前先报材料牌号', from:'对标拆解'},
  {title:'爆款《便宜三成》续集：到货怎么复检', from:'复盘续集'},
  {title:'合同里写公差这件事', from:'定位问答'}
];
```

- [ ] **Step 2: `renderTopics` 六态**

按规格 §4.7：
- `空`：一句「还没有选题」+ 两按钮「去定位加高频问答」「去拆一条对标」。
- `加载`：脉冲条。
- `失败`：一句 + 重试。
- `有选题`：`DEMO.topics` 列表，每条显来源 + 「进创作」。
- `刚从FAQ生成`：列表顶部置顶高亮一条「设备为什么便宜三成」（背景淡 `--ink-soft`），表示刚生成成功（规格 §4.7 末段）。
- `含原问答已删除`：列表中来自问答的那条显「原问答已删除」灰标签（仍可进创作，规格 §4.7）。

来源只有三路（定位问答/对标拆解/复盘续集），**没有** 「拉取今日热点」，列表不会自己变长（规格 §4.7 首段）——UI 上不出现热点入口。

- [ ] **Step 3: 浏览器验收 §5 选题库行**

逐格点 6 态。确认无「今日热点」入口；刚从FAQ生成态置顶高亮；含原问答已删除态有灰标签且仍可点进创作。

- [ ] **Step 4: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 选题库六态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 文案创作（十一态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderCreate`；`DEMO` 加 `createDraft`/`createRef` 切片）。

**Interfaces:**
- Produces: `register('create', ['未校准','空态','生成中','失败','额度不够','只有抖音版','两版都在','查重提示','无关选题无参考','改已有稿','采用成功'], renderCreate)`。
- 「保存回知识库」「去校准定位」等按钮跨页跳转。

**内容来源**：规格 §4.8（含 line 175–187 全部规则）、§3 人设声音位置行。

- [ ] **Step 1: `DEMO` 创作切片**

```js
DEMO.createDraft = {
  topic:'便宜三成不是偷工减料', duration:'60s',
  douyin:'便宜三成？不是偷工减料。我是工厂直营，没中间商……（口播正文）',
  video:'同样的稿子换个钩子开头……（视频号版正文）'
};
DEMO.createRef = [
  {title:'便宜三成不是偷工减料', platform:'抖音', sim:'高'}
];
DEMO.createUnrelated = '本稿只基于你的定位档案';
```

- [ ] **Step 2: 常驻两栏骨架**

`renderCreate` 外层两栏：左栏自上而下 = 人设声音卡（`DEMO.profile` 的人设/口吻/红线，与定位同一份；取消按钮）→ 一句话选题 + 时长芯片（规格 line 175）→ 生成按钮 → 抖音/视频号页签 → 正文 → 底部三按钮（采用当前平台版 / 换个角度 / 复制全文）。右栏 = 参考区（规格 §4.8 右栏）。人设声音在输入框**上方**，不是右栏（规格 §3 人设声音位置行）。

- [ ] **Step 3: 十一态分支**

按规格 §4.8 line 180–187：
- `未校准`：人设区改为「去校准定位」（→ setPage('calibrate)），仍可生成通用稿（生成按钮在）。
- `空态`：选题输入空 + 右栏「知识库可参考 N 篇」（N=`DEMO.numbers.kb`）。
- `生成中`：阶段进度遮罩，无流式（line 187）。
- `失败`：一句 + 重试。
- `额度不够`：点生成或换角度触发——主区出「额度不够，去充值」（→ setPage('recharge)）。规格 §5 末行：不必先拨 stage 到额度用尽。
- `只有抖音版`：抖音页签有 `DEMO.createDraft.douyin`，视频号页签提示「切到这里将生成，不另扣额度」（line 180）。
- `两版都在`：两页签都有正文。
- `查重提示`：正文上方一条**非阻断**黄条「这篇和《便宜三成不是偷工减料》相似度高，可换个角度或继续采用」；采用按钮仍可用（line 182）。
- `无关选题无参考`：右栏写「本稿只基于你的定位档案」（line 176 末句）。
- `改已有稿`：主按钮变「保存回知识库」；保存不新开、不扣费（line 183）。
- `采用成功`：当前平台按钮已变「已采用」+ 一句「已存入知识库」；同一平台重复点不新增（line 181）。

底部三按钮规则（line 181/184）：采用 = 该平台版写入知识库（来源「平台生成」、状态「未发布」，D14）；换角度 = 新一轮扣 1 条；复制全文不入库。无小红书（line 185）。

- [ ] **Step 4: 浏览器验收 §5 创作行（11 格）**

逐格点 11 态。重点确认：人设声音在左栏输入框上方（非右栏）；查重提示不阻断采用；采用成功按钮变「已采用」；改已有稿主按钮变「保存回知识库」；只有抖音版切视频号提示「不另扣额度」。

- [ ] **Step 5: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 文案创作十一态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 对标拆解（七态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderAnalyze`；`DEMO.analyze` 切片）。

**Interfaces:**
- Produces: `register('analyze', ['空','进行中','失败','额度不够','账号结果','视频结果','已存入选题'], renderAnalyze)`。
- 两页签：拆账号 / 拆视频。

**内容来源**：规格 §4.9。

- [ ] **Step 1: `DEMO.analyze` 切片**

```js
DEMO.analyze = {
  portrait:{对比:[['人设','说真话工厂老板','同行讲排场'],['人群','30-45 业主','泛创业者']], top10:[{title:'开工前先报材料牌号',plays:'12万'}]},
  fourFields:{结构:'钩子3s + 痛点 + 证据 + 转化', 为什么爆:'戳中怕被坑', 框架:'报牌号→合同→复检', 和你的差异:'你更直，他更演'}
};
```

- [ ] **Step 2: `renderAnalyze` 七态**

按规格 §4.9：
- `空`：两页签 + 输入框（贴主页 / 贴链接或粘文案）+ 「拆」按钮。
- `进行中`：脉冲条「正在拆…」。
- `失败`：一句 + 重试。
- `额度不够`：「拆账号扣 10 条，额度不够」+ 去充值。
- `账号结果`：画像对比表 + TOP10 + 深拆在本页展开四字段（结构/为什么爆/框架/和你的差异，`DEMO.analyze.fourFields`），**不跳详情态**。按钮「存入选题库」。
- `视频结果`：同一套四字段 + 「用这个框架仿写」（→ setPage('create')）+「存入选题库」。
- `已存入选题`：按钮变「已存入 / 去选题库」（→ setPage('topics')）。

不画「监控中的账号」（规格 §4.9 首行）；不画视频文案详情态、不预填 `/analyze?video=`、不画全文沉底折叠（规格 §4.9 末段）。

- [ ] **Step 3: 浏览器验收 §5 拆解行**

逐格点 7 态。确认深拆四字段在本页展开（非跳详情）；已存入选题按钮态变化。

- [ ] **Step 4: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 对标拆解七态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 知识库（七态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderKb`；`DEMO.kb` 切片）。

**Interfaces:**
- Produces: `register('kb', ['空','加载','失败','有内容','筛选后为空','新建编辑','登记弹窗'], renderKb)`。

**内容来源**：规格 §4.10。

- [ ] **Step 1: `DEMO.kb` 切片**

```js
DEMO.kb = [
  {title:'便宜三成不是偷工减料', src:'平台生成', status:'爆款'},
  {title:'合同里写公差这件事', src:'我传的', status:'未发布'},
  {title:'工厂老板的一天', src:'平台生成', status:'已发布'},
  {title:'到货复检三步', src:'我传的', status:'未发布'}
];
```

- [ ] **Step 2: `renderKb` 七态**

按规格 §4.10：
- `空`：两句空态 + 两按钮「去创作」「把旧文案粘进来」（→ `新建编辑`）。
- `加载`：脉冲条。
- `失败`：一句 + 重试。
- `有内容`：列表 + 来源筛（平台生成/我传的）+ 状态筛（未发布/已发布/爆款）+ 页头「共 N 篇 · 爆款 M 篇」。平台稿「去创作页改」（→ setPage('create') 改已有稿态），我传的「改/删」。
- `筛选后为空`：列表空 + 「当前筛选下没有，清掉筛选」。
- `新建编辑`：Markdown 编辑（标题 + 正文）+「保存」（来源=我传的，规格 line 202）。保存 → 回 `有内容`。
- `登记弹窗`：`modal()` 叠层——选抖音或视频号 + 贴链接 +「登记」（不抓数，规格 line 204）。一篇可登多个平台。

来源标签**只有两种**：平台生成 / 我传的（不叫「手建」，规格 line 200）。爆款只能复盘判出，不能手勾（line 205）——UI 上无「标为爆款」勾选。

- [ ] **Step 3: 浏览器验收 §5 知识库行**

逐格点 7 态。确认来源只有两标签、无「标为爆款」勾选；登记弹窗只选平台+贴链接、无抓数提示。

- [ ] **Step 4: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 知识库七态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: 发布复盘（七态）

**Files:**
- Modify: `随口说原型-2026-08-16.html`（新增 `renderReview`；`DEMO.review` 切片）。

**Interfaces:**
- Produces: `register('review', ['待发布空','已登记未复盘','已复盘','爆款降级','周报空','周报生成中','有周报'], renderReview)`。

**内容来源**：规格 §4.11。

- [ ] **Step 1: `DEMO.review` 切片**

```js
DEMO.reviewPending = [{title:'材料牌号怎么写进合同', platform:'抖音'}];
DEMO.reviewRegistered = [{title:'便宜三成不是偷工减料', platform:'抖音', link:'v.douyin.com/abc1', reviewed:false}];
DEMO.reviewDone = [{title:'便宜三成不是偷工减料', platform:'抖音', result:'爆款', fiveCode:{play:'12万',like:'8200',comment:'610',share:'430',follow:'210'}}];
DEMO.weeklyReport = '本周发布 3 篇，1 篇爆款《便宜三成》。建议续集：到货复检。';
```

- [ ] **Step 2: `renderReview` 七态**

按规格 §4.11：
- `待发布空`：待发布列表空 +「还没有待发布，去知识库登记一篇」。
- `已登记未复盘`：`DEMO.reviewRegistered` 行 + 「复盘」按钮（→ 点了出五码）。
- `已复盘`：`DEMO.reviewDone` 行 + 五码 + 普通/爆款标签。
- `爆款降级`：一条原爆款行降级为已发布 + 灰提示「某发布记录数据更新，标签降级；原续集选题保留」（规格 line 212）。不重复创建续集。
- `周报空`：「本周还没复盘周报」+ 「生成本周复盘」按钮。
- `周报生成中`：脉冲条「生成中」。
- `有周报`：`DEMO.weeklyReport` 卡片 + 「再生成」。

无「未采用」行、无自动周报（规格 line 213）；只有手动「生成本周复盘」。

- [ ] **Step 3: 浏览器验收 §5 复盘行**

逐格点 7 态。确认无「未采用」行；爆款降级态文案写明「原续集选题保留、不重复创建」；周报只有手动生成。

- [ ] **Step 4: Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): 发布复盘七态

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: 全站收尾——确认条、§5 全格过审、最终验收

**Files:**
- Modify: `随口说原型-2026-08-16.html`（全局 `confirmDanger(msg, onOk)` 辅助 + 替换所有应走确认条的危险操作；§5 全格点过）。

**Interfaces:**
- Consumes: 全部前 10 任务。
- Produces: 全站统一 `confirmDanger()`（替代任何残留 `alert/confirm`）；一份填好的 §5 验收清单（写到提交说明里）。

**内容来源**：规格 §6（危险操作用确认条，不要原生 alert）、§5（每格可点）、§8 第 3 步。

- [ ] **Step 1: 落 `confirmDanger` 辅助**

```js
function confirmDanger(msg, onOk){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-card card" style="max-width:420px">
    <p style="margin:0 0 16px">${msg}</p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn ghost" id="__cg_cancel">取消</button>
      <button class="btn danger" id="__cg_ok">确认</button>
    </div></div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#__cg_cancel').onclick = ()=>overlay.remove();
  overlay.querySelector('#__cg_ok').onclick = ()=>{overlay.remove(); onOk();};
}
```

- [ ] **Step 2: 把危险操作接上 `confirmDanger`**

扫全文件，确认这些点用 `confirmDanger`、**不**用 `alert/confirm`（规格 §6）：
- 知识库「删」我传的稿 → `confirmDanger('删除这篇？不可恢复。', ()=>{/* UI 移除该行 */})`。
- 账号·定位「退出校准/放弃修改」→ `confirmDanger('放弃这次修改？', ()=>{/* 回打开时态 */})`。
- 账号·资料换绑「确认换绑」→ `confirmDanger('确认换绑到新手机号？', ()=>{/* setState('换绑验证码错') 或成功 */})`。
- 复盘「再生成周报」覆盖 → `confirmDanger('重新生成会覆盖本周周报，继续？', ()=>{...})`。

- [ ] **Step 3: §5 全格过审**

打开文件，**逐格** 点审查条「页面 × 状态」共 12 行。对着规格 §5 表逐行核对，确认每格：
1. 能切到（状态下拉有该选项）。
2. 切到后界面非空白、非 fallback 占位（除非该格本就该空，如「空」态）。
3. 界面含规格 §4 对应该态的关键元素。

把核对结果记成清单（行 × 格 → ✓/✗）。有 ✗ 回对应任务修。

- [ ] **Step 4: 账号阶段联动复核**

切 `stage` 四档 × 几个代表页，确认：
- `new` + 工作台 → 刚开通引导。
- `new` + 选题库/知识库/复盘 → 空。
- `exhausted` + 创作 → 可切到「额度不够」态（显式 state 优先，规格 §5 末行）。

- [ ] **Step 5: 视觉约定复核（规格 §6）**

确认：底 `#f4f1e9` / 主色 `#8a5a2b` / 侧栏暖炭 / 标题宋体；主区最大宽 880–1120；空态一句人话 + 一个主按钮、无插画墙；加载脉冲条、无骨架屏迷宫；危险操作走确认条、无原生 alert；审查条深底 +「原型审查」字样 + 高 36–40px、不挡侧栏品牌名。

- [ ] **Step 6: 最终 Commit**

```bash
cd /Users/rick/work/sks-web
git add prototypes/随口说原型-2026-08-16.html
git commit -m "feat(prototype): C 端全站原型收尾——确认条 + §5 全格可点

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 验收完成定义（规格 §8 第 3 步）

本计划全部任务做完后：审查条能切到 §5 **每一格** 页×状态，每格界面符合 §4 描述，视觉符合 §6。此时原型进入「待你用审查条点完 + 说锁定」状态。**锁定前不碰三仓业务代码、不碰旧原型与 PROTOTYPE_GAP.md**（规格 §8 第 5 步、§7）。

## 非目标（不在本计划内）

- 管理后台、手机/响应式、视频文案详情态、在线支付、真短信、真二维码、文件上传、流式输出、自动热点/复盘/对标监控、小红书（规格 §9）。
- 改 D18–D21 规格、改 React、改旧原型与 PROTOTYPE_GAP.md——这些是**锁定后** 另开一刀（规格 §8 第 4 步、§7）。
