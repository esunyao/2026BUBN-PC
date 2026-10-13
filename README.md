# Shared Moment World · 共同时刻世界

把共同旅行中的地点组成像素群岛，抵达岛屿后查看不同旅伴留下的照片。这是一个 Vue 纯前端原型，示例旅行和照片为虚构素材。

当前 UI 和核心体验仍需大幅调整，现有版本用于保留原型与开发结构；技术检查通过不代表产品方案已完成验收。

## 1. 准备环境

运行前端需要：

| 工具 | 要求 |
| --- | --- |
| Git | 用于克隆与协作 |
| Node.js | 推荐 [24 LTS](https://nodejs.org/en/download)，至少24.12.0；完整支持范围见 frontend/package.json |
| pnpm | 固定10.28.1，与 packageManager 和锁文件保持一致 |
| 浏览器 | Chrome、Edge 等现代浏览器 |

安装 Node.js 后重新打开终端，检查版本并安装 pnpm：

```sh
node --version
npm --version
npm install --global pnpm@10.28.1
pnpm --version
```

如果 Git Bash 或 WSL 仍命中旧 Node，按 [前端环境排查](frontend/README.md#旧-node-与终端路径排查) 修正路径。Windows 与 WSL 应各自使用一致的 Node/npm/pnpm 环境。

## 2. 克隆并启动前端

```sh
git clone https://github.com/esunyao/2026BUBN-PC.git
cd 2026BUBN-PC/frontend
pnpm install --frozen-lockfile
pnpm dev
```

打开终端中 Vite 输出的地址。首次安装需要下载依赖，按 Ctrl+C 停止开发服务。当前演示在浏览器本地运行，无需后端、数据库、API 密钥或 .env 配置。

导入照片前选择拍摄者；图片只保留在当前页面会话，刷新恢复示例旅行。具体操作见 [MVP 演示说明](doc-bg/20261013mvp/README.md)。

## 3. 检查、构建与预览

以下命令均在 frontend 目录执行：

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm type-check
pnpm build
pnpm preview
```

build 同时执行类型检查和生产打包，产物在 frontend/dist。preview 用于本地查看构建产物，地址以终端输出为准。已有验证结果见 [验证记录](frontend/doc/verification.md)。

## 4. 开发单节点后端

backend/Archipelago 使用 Kotlin、Spring Boot 4.1.0 和 Java 21，提供 OAuth/OIDC、SQLite 事件元数据与 RustFS 预签名。当前前端未接入后端，仍可独立演示。Gradle Wrapper 已随仓库提供，安装 JDK 21 并确认 JAVA_HOME 后，从仓库根目录执行：

```sh
cd backend/Archipelago
cp .env.example .env
./gradlew test
./gradlew build
./gradlew bootRun
```

首次复制后需先编辑 .env 并填写初始演示密码，已有 .env 不要覆盖。Windows PowerShell 或命令提示符使用 .\gradlew.bat。详细配置、RustFS 准备及验收结果见 [后端 README](backend/Archipelago/README.md)，字段见 [OpenAPI](backend/Archipelago/doc/openapi.yaml) 与 [数据库说明](backend/Archipelago/doc/database.md)。

## 5. 阅读项目

| 内容 | 入口 |
| --- | --- |
| 前端环境与命令 | [frontend/README.md](frontend/README.md) |
| 架构与数据流 | [frontend/doc/README.md](frontend/doc/README.md) |
| 后端初始化与数据流 | [backend/Archipelago/README.md](backend/Archipelago/README.md) → [后端总览](backend/Archipelago/doc/README.md) |
| 需求、模拟图与原型截图 | [doc-bg/20261013mvp](doc-bg/20261013mvp/README.md) |
| Agent 协作规范 | [AGENTS.md](AGENTS.md) |
| AI 使用与过程记录 | [AI_USAGE.md](AI_USAGE.md) |

前端代码按 app、features、navigation、shared 分层，各层 AGENTS.md 和 doc/README.md 说明职责与接口。提交使用英文 Conventional Commits，分支按项目负责人安排。
