# Shared Moment World

纯前端的共同时刻世界 MVP：像素群岛承载地点，照片记录共同旅行。演示数据和图片为虚构素材。当前原型 UI 与核心体验尚未完成用户验收，检查通过不代表最终产品已获认可。

## 初始化环境

推荐安装 [Node.js 24 LTS](https://nodejs.org/en/download)，版本至少为 **24.12.0**；安装包包含 npm。项目允许的完整 Node 范围为 `^22.18.0 || >=24.12.0`，以 [package.json](package.json) 为准。

安装后重新打开终端，先检查 Node 与 npm，再安装项目固定版本 **pnpm 10.28.1**。安装方式可参考 [pnpm 官方说明](https://pnpm.io/installation)。

```sh
node --version
npm --version
npm install --global pnpm@10.28.1
pnpm --version
```

确认 Node 符合上述范围、npm 能正常运行、pnpm 输出 `10.28.1`。从仓库根目录进入前端并安装锁定依赖：

```sh
cd frontend
pnpm install --frozen-lockfile
```

首次安装需要网络下载依赖。后续命令均在 `frontend/` 下执行。

## 开发与预览

```sh
pnpm dev
```

打开 Vite 在终端输出的本地地址；按 `Ctrl+C` 停止服务。当前演示完全在浏览器本地运行，**不需要启动后端，也不需要 `.env` 或 API 密钥**。

检查与生产构建：

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm type-check
pnpm build
```

`pnpm build` 同时执行类型检查与生产打包，输出到 `dist/`。构建后可启动本地预览：

```sh
pnpm preview
```

预览地址仍以终端输出为准；它用于本地检查构建产物。

## 旧 Node 与终端路径排查

若安装新版 Node 后仍显示 Node 12，或 pnpm 出现 `Unexpected token '.'`、Node 版本不受支持等错误，先在 Git Bash 或 WSL 检查实际命中的程序：

```sh
type -a node npm pnpm
node --version
npm --version
```

- **Windows Git Bash**：重新打开终端，确认 Windows Node 安装目录位于 PATH 中旧版本之前。使用默认安装位置时，可在当前 Git Bash 临时修正路径：

  ```sh
  export PATH="/c/Program Files/nodejs:$PATH"
  hash -r
  node --version
  npm --version
  npm install --global pnpm@10.28.1
  pnpm --version
  ```

  自定义安装位置应替换第一行路径。该修改仅影响当前终端；长期使用请调整 Windows 的 PATH，然后重新打开终端。

- **WSL**：Windows 安装的 Node 不会替换 WSL 的 `/usr/bin/node`。按 Node 官方安装页在 WSL 内安装 Linux 版 Node 24 LTS，将其 `bin` 目录放到 WSL PATH 中旧 Node 之前，然后执行 `hash -r` 并重新检查版本。使用同一套 Linux Node/npm 安装 `pnpm@10.28.1`，避免混用 `/mnt/c/` 下的 Windows npm/pnpm 与 WSL 的旧 Node；也可改在 Windows Git Bash 完成上面的初始化步骤。

环境切换后，在选定环境中重新执行 `pnpm install --frozen-lockfile`，让平台相关依赖与运行环境一致。

## 照片与会话限制

每批导入先选择一位拍摄者。浏览器可显示的 JPEG、PNG、WebP 会在本地解析；缺少 GPS 的照片可手动安放。导入照片及新地点只保留在当前页面会话内，**刷新页面后恢复虚构示例**，没有上传、跨设备同步或持久保存。

## 阅读入口

- [前端协作规范](AGENTS.md)
- [架构、使用与验证](doc/README.md)
- [MVP 模拟图与演示](../doc-bg/20261013mvp/README.md)
