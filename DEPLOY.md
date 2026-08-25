# light-helper · 上线部署指南（Cloudflare Workers）

这个项目本来就是为 Cloudflare Workers 写的，发布只需一条命令，全程约 5 分钟。

> 为什么不能用 GitHub Pages：本项目使用 vinext（服务端渲染），需要 Worker 运行时，GitHub Pages 只能放静态文件。

---

## 一次性准备（首次需要）

### 1. 登录 Cloudflare

```bash
cd 本项目目录
npx wrangler login
```

会自动打开浏览器，授权你的 Cloudflare 账号（免费注册 https://dash.cloudflare.com）。

### 2. （可选）把 Worker 名字改成 light-helper

默认 Worker 名是 `site-creator-vinext-starter`，域名会变成 `site-creator-vinext-starter.你的账号.workers.dev`，比较丑。想好看一点，改一下 `package.json` 里的 `name`：

```json
"name": "light-helper"
```

---

## 发布（每次更新都执行这两条）

```bash
# 1. 构建（会生成 dist/server/wrangler.json + Worker 产物）
npm run build

# 2. 部署到 Cloudflare Workers
npx wrangler deploy --config dist/server/wrangler.json
```

部署完成后，终端会打印公网地址，形如：

```
https://light-helper.你的账号.workers.dev
```

打开它，就能在手机上/电脑上用灯光助手了 💡

---

## 常见问题

| 问题 | 处理 |
|---|---|
| `wrangler login` 打不开浏览器 | 终端会打印一个 URL，手动复制到浏览器打开 |
| 想绑定自己的域名 | Cloudflare 控制台 → Workers → 你的 Worker → Settings → Domains & Routes |
| 部署后白屏 | 确认 `npm run build` 成功，再重新 `wrangler deploy` |
| 想回到内部托管 | 本项目的内部托管（chatgpt-team.site）不受影响，两条部署互不干扰 |

---

## 说明

- 本项目**无数据库依赖**（计算全部在浏览器本地完成），部署到 Cloudflare Workers 无需额外配置 D1/R2
- 照片分析、照度计算都在用户浏览器本地完成，不上传任何照片，无需后端隐私配置
