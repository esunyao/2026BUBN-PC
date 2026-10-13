# 共同记忆前端

Vue 3、TypeScript、Vite。保留 Hero、人物显影、回放、Then & Now、星图和 Discovery；篇章数据统一由后端保存。

## 初始化

先按[后端 README](../backend/Archipelago/README.md)启动服务。需要 Node.js 22 以上和 pnpm 10。复制 frontend/.env.example 为 frontend/.env.local，配置浏览器可达的 API 地址和 OIDC issuer；本地默认均为 http://localhost:8080。然后在 frontend 目录运行：

    pnpm install --frozen-lockfile
    pnpm dev

前端默认 http://localhost:5173，OIDC 回调地址为 /auth/callback。正式部署要求 HTTPS，并对页面深链接和回调设置 SPA 回退。浏览器上传还需要 RustFS 桶 CORS 允许前端来源。

## 在线功能

先注册用户名、密码与邮箱，再通过 OIDC 授权码及 PKCE S256 登录。邮箱当前不验证。Access Token 仅保留在页面内存；刷新时重新授权。两套示例只读，可复制为个人篇章。

登录后可创建篇章、按用户名添加已注册成员、保存自己的原文和照片、补写 Gap、记录发现反馈及导入导出 JSON。人物显影只切换观看视角，不改变账号身份。原图、缩略图和环境底图经预签名直传 RustFS；JSON 不包含图片字节。服务失败会提示错误，不退回本地存档，旧浏览器存档也不自动迁移。

Discovery 继续用现有规则和标识明确的示例分析，不调用真实模型。public 贡献当前仍只对事件成员可见。

## 源码与验证

- src/app/App.vue：主页面；src/app/useMemories.ts：会话状态和线上加载；src/app/onlineRepository.ts：后端 API 适配；src/app/useAuth.ts：OIDC。
- src/features/：Hero、Discovery、登录和媒体分析；src/shared/：类型与请求工具。
- [后端 OpenAPI](../backend/Archipelago/doc/openapi.yaml)、[线上契约](../backend/Archipelago/doc/online-contract.md)及[素材来源](../ASSET_CREDITS.md)。

    pnpm test
    pnpm type-check
    pnpm lint
    pnpm build
    pnpm format:check

本轮 30 项 Vitest、类型检查和生产构建通过。真实浏览器 RustFS 上传仍受桶 CORS 配置影响，见[后端验证记录](../backend/Archipelago/doc/verification.md)。
