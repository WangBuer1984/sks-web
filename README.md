# sks-web

前端（React 18 + Vite + TypeScript + Tailwind）+ nginx 静态服务。无运行期/构建期 env，一个镜像任何环境通用。

## 本地跑

```bash
npm install
npm run dev
```

## 镜像构建

```bash
docker build -t ghcr.io/wangbuer1984/sks-web:dev .
```
CI 在 git tag `v*` 时 build+push 到 GHCR（零 secret）。镜像只保证 `linux/amd64`。
