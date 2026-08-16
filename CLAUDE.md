# CLAUDE.md — sks-web 仓

本仓为前端（React 18 + Vite + TypeScript + Tailwind）+ 静态服务（nginx:alpine serve SPA）。

## 硬不变量（实现时不得违背）

- **纸感色板**：`#f4f1e9`（底）/ `#8a5a2b`（主色）/ `Noto Serif SC`（衬线标题），落为 tailwind.config.js 主题变量。
- **TanStack Query 管服务端态 + Zustand 管客户端态**。
- **axios 双实例**：`userClient` baseURL `/api` 注入 `sks_token`；`adminClient` baseURL `/api/admin` 注入 `sks_admin_token`，两套隔离。
- **401**：清 token + 存回跳路径 `returnKey` + 跳对应登录页（C 端 `/login`、管理端 `/admin/login`）；router 守卫 + axios 拦截器双保险。**注意：当前实现只存回跳路径、未存表单内容——PRD §11.6 表单存 localStorage 是既有 gap，不得写成"401 保内容"。**
- **无流式输出** → 用多阶段进度动画 mask 等待。
- **无任何运行期/构建期 env**：axios 用相对基址 `/api`+`/api/admin`，全代码库无 `VITE_` 变量，镜像环境无关，CI 零 secret。

## 视觉基准

`prototypes/` 是前端视觉基准。C 端已锁定为 `随口说原型-07191700.html`（规格：`docs/superpowers/specs/2026-08-16-c-end-prototype-design.md`）：手改 `extracted/full.html` 后跑 `node scripts/repack-prototype.mjs` 写回，不要用设计工具重新导出覆盖。Admin 原型仍只读。`随口说原型-2026-08-16.html` 已作废，不当基准。

## 契约

错误码全表与 `ApiResponse` 形状见 sks-server 仓 `docs/REST_CONTRACT.md`。

## 本仓构建/测试命令

- `npm install` / `npm run dev`（本地跑）/ `npm run build`（构建，产物带 hash）
- 镜像构建：`docker build -t ghcr.io/wangbuer1984/sks-web:dev .`（CI 零 secret）
