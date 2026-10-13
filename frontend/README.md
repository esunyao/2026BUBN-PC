# Shared Moment World

纯前端的共同时刻世界 MVP：像素群岛承载地点，照片记录共同旅行。演示数据和图片为虚构素材。

## 启动

使用 Node 22.18+ 或 24.12+ 与 pnpm（准确范围见 package.json）。

```sh
pnpm install --frozen-lockfile
pnpm dev
```

默认地址由 Vite 输出。Git Bash 若命中旧的 WSL Node，请改用已安装的 Windows Node 24+ 运行 pnpm，保持当前项目配置。

## 检查

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm type-check
pnpm build
```

## 阅读入口

- [前端协作规范](AGENTS.md)
- [架构、使用与验证](doc/README.md)
- [MVP 模拟图与演示](../doc-bg/20261013mvp/README.md)
