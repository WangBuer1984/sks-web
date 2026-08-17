# 百度可发现性（2026-08-17）

> 状态：**待实现**。方案 B：给爬虫可读的 HTML 壳 + 真 robots/sitemap + 落地页备案号；收录提交在百度搜索资源平台完成。
> 不改：SSR / 预渲染、百度主动推送 API、登录后工作台、`prototypes/`。

日期：2026-08-17  
范围：`sks-web` 公开落地页与静态资源；用户在百度站长平台的操作写在 §5，不进代码。  
目标搜索引擎：百度。成功标准见 §6。

---

## 0. 一句话

让百度不跑 JS 也能认出「随口说」官网，并具备提交收录的文件；不保证搜这个词立刻排第一。

---

## 1. 已确认的决策

| # | 决策 |
|---|---|
| D1 | 目标引擎是**百度**，不做谷歌 Search Console、不做多引擎站长包 |
| D2 | ICP：`鲁ICP备2026038792号`，链到 `https://beian.miit.gov.cn/`，只出现在落地页页脚 |
| D3 | 不走 SSR / 构建时预渲染；用 `index.html` 的 meta + `<noscript>` 给爬虫正文 |
| D4 | 真文件 `public/robots.txt`、`public/sitemap.xml`（Vite 原样拷到 dist；sks-web nginx `try_files $uri` 会命中文件，不再落到 SPA） |
| D5 | sitemap **只含** `https://suikoushuo.com/`；不提交登录页、工作台、admin |
| D6 | `robots.txt`：允许 `/`；禁止 `/admin` 与 `/admin/`；写上 sitemap 绝对地址 |
| D7 | 规范域名为裸域 `https://suikoushuo.com/`（`rel=canonical`）。www 与裸域目前同内容，**本次不改网关 301** |
| D8 | 无 `VITE_` / 运行时 env；生产域名写死在静态文件里 |
| D9 | 不改 `prototypes/` |
| D10 | 百度验证码/验证文件等用户拿到后再加，不在首发写占位 token |

---

## 2. HTML 壳（`index.html`）

现有 `<title>随口说</title>`，无 description，`<body>` 只有空 `#root`。改为：

| 字段 | 值 |
|---|---|
| `html lang` | 保持 `zh-CN` |
| `title` | `随口说 — 口播博主的 AI 内容工作台` |
| `meta name="description"` | `面向口播博主与获客老板的 AI 内容工作台。「随口说」记住你的人设、口吻和业务知识，从账号定位到选题、创作、发布复盘，全流程陪你把号做起来。` |
| `meta name="keywords"` | `随口说,口播,口播文案,AI写作,抖音口播,视频号,内容工作台` |
| `link rel="canonical"` | `https://suikoushuo.com/` |

`<noscript>`（放在 `#root` 旁，给不执行 JS 的百度蜘蛛）须含：

- 品牌名：随口说
- 与落地页一致的 H1 语义：让每条口播稿都像你本人写的
- 一段简介：逐字用 `Landing.tsx` Hero 段「不是又一个 AI 写作工具。「随口说」记住你的人设、口吻和业务知识，从账号定位到选题、创作、发布复盘，全流程陪你把号做起来。」
- 入口说明：免费开始，手机号登录；站点 `https://suikoushuo.com/`

不增加 Open Graph / JSON-LD（本次不需要）。不增加百度验证 meta，直到用户从站长平台拿到验证串。

保留现有 favicon、theme-color、`#root`、入口 script。

---

## 3. 静态文件

### 3.1 `public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/

Sitemap: https://suikoushuo.com/sitemap.xml
```

### 3.2 `public/sitemap.xml`

标准 sitemap 1.0，仅一条 url：`https://suikoushuo.com/`。`changefreq` = `weekly`，`priority` = `1.0`。

本地 `npm run dev` 也会提供这两文件；内容指向生产域名，这是有意的（给百度看的地图，不是给 localhost 的）。

---

## 4. 落地页页脚（`src/pages/Landing.tsx`）

现有最后一行：

`随口说 · by 王不二 · 微信：suikoushuo-wang`

其下新增一行：

- 可见文本：`鲁ICP备2026038792号`
- `href="https://beian.miit.gov.cn/"`，`target="_blank"`，`rel="noreferrer"`
- 样式：沿用该段 `text-meta text-paper-mutedLight`，不要主色、不要按钮
- 仅此页；`AppLayout` / 工作台 / 登录页不加
- 不改原型 HTML

---

## 5. 代码外：百度搜索资源平台

发版（新 `sks-web` 镜像上线）之后，站长用百度账号登录 https://ziyuan.baidu.com/ ：

1. 添加站点 `https://suikoushuo.com`
2. 验证：优先**文件验证**（把 `baidu_verify_*.html` 放到 `sks-web/public/` 再发一版，或临时放到线上 web 根）。不要把未发放的假 token 先写进仓库
3. 提交 sitemap：`https://suikoushuo.com/sitemap.xml`
4. 站点名称申请为「随口说」
5. 「抓取诊断」看首页：应能读到 §2 的 title / description / noscript 文案

普通收录常见几天到两周。在此之前搜「随口说」仍会先出词典；`site:suikoushuo.com` 有结果才算进索引。

---

## 6. 成功标准

代码合并并生产发版后，无需登录即可：

| 检查 | 期望 |
|---|---|
| `curl -sS https://suikoushuo.com/robots.txt` | 上文 §3.1 文本，不是落地页 HTML |
| `curl -sS https://suikoushuo.com/sitemap.xml` | 含 `https://suikoushuo.com/` 的 xml，不是落地页 HTML |
| `curl -sS https://suikoushuo.com/` 的 HTML 源码 | 含新 title、description、canonical、noscript 里的「随口说」 |
| 打开落地页页脚 | 备案号可点，链到工信部 |
| 落地页其余块 | 与改前视觉一致（多一行备案） |

**不作为本次完成条件：** 百度搜「随口说」出现官网（受收录队列和词典竞争影响）。完成条件止于「可被抓、可被提交、页脚合法」。

---

## 7. 不做

- 构建时预渲染或 SSR
- 百度/搜狗/谷歌自动 ping
- 给 `/login` 及登录后路由做 SEO
- www → 裸域 301（可另开）
- 改 `sks-agent` 网关 conf（web 容器自己的 `try_files` 足够）
- 硬编码百度验证 token

---

## 8. 涉及文件

| 文件 | 动作 |
|---|---|
| `sks-web/index.html` | 改 title / meta / canonical / noscript |
| `sks-web/public/robots.txt` | 新建 |
| `sks-web/public/sitemap.xml` | 新建 |
| `sks-web/src/pages/Landing.tsx` | 页脚加备案链接 |
| `prototypes/` | 不改 |
