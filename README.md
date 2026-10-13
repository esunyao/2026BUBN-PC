# 共同记忆 · Shared Memories

照片优先的 Vue 3 + TypeScript 交互体验。Home → Event → Scene / Focus，人物显影、交汇时刻、时间轴、昨日与今日、记忆星图和四种自适应环境可独立演示；新增 Discover、其他作者视角与无照片时段补写。后端沿用 Kotlin / Spring Boot / Java 21 架构。

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
git clone --branch feat/shared-memories-hero https://github.com/esunyao/2026BUBN-PC.git
cd 2026BUBN-PC/frontend
pnpm install --frozen-lockfile
pnpm dev
```

打开终端中 Vite 输出的地址。首次安装需要下载依赖，按 Ctrl+C 停止开发服务。当前演示在浏览器本地运行，无需后端、数据库、API 密钥或 .env 配置。

在 Scene 点击“留下记忆”，选择人物、时刻与心情，上传本地照片或写入原文。照片存于 IndexedDB，文字与配置存于 localStorage，刷新仍保留。导出 JSON 只包含文字与配置，不包含照片文件。

90 秒路线：海陵岛之旅 → 海边漫步 → 人物切换 → 日落 Focus → 另一双眼睛 → 时间轴与 2x 回放 → 元旦晚会 → 昨日与今日 → 星图点选。详见 [实现说明](IMPLEMENTATION_NOTES.md)、[素材署名](ASSET_CREDITS.md)。全部图片本地托管，示例叙述、人物与时间明确标为 Demo，不代表真实同一次活动。

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

## 4. 可选：开发后端骨架

backend/Archipelago 使用 Kotlin、Spring Boot 和 Java 21，Gradle Wrapper 已随仓库提供。安装 JDK 21，确保 java --version 与 JAVA_HOME 指向该版本，从仓库根目录执行：

```sh
cd backend/Archipelago
./gradlew test
./gradlew build
./gradlew bootRun
```

Windows PowerShell 或命令提示符进入 backend/Archipelago 后，使用 .\gradlew.bat test、.\gradlew.bat build、.\gradlew.bat bootRun。当前后端是初始化骨架，尚未提供前端调用的 HTTP 业务接口；上述后端命令本轮未执行验证。

## 5. Discovery 与后端协作

在 Event 或 Scene 点击“记忆发现 / Discover”，筛选照片证据、关联解释和原文。Unseen 支持 A/B/并看、收藏/隐藏/恢复；Missing Pieces 支持多人分别为同一时段补写，形成 text-only Moment，联动时间轴、便笺与星图，刷新保留。

已实现 sameMoment / unseen / gap / sceneEvolution 及后台阶段 Demo；memory_thread 仅保留契约。识别标签为 Mock/手工标注，用户图片只使用真实 EXIF 或手动时刻；没有真实 AI 推理。后端契约见 [BACKEND_COLLABORATION](BACKEND_COLLABORATION.md)，已通过 [Issue #1](https://github.com/esunyao/2026BUBN-PC/issues/1) 指派给 esunyao。

## 6. 阅读项目

| 内容 | 入口 |
| --- | --- |
| 前端环境与命令 | [frontend/README.md](frontend/README.md) |
| 架构与数据流 | [frontend/doc/README.md](frontend/doc/README.md) |
| 需求、模拟图与原型截图 | [doc-bg/20261013mvp](doc-bg/20261013mvp/README.md) |
| Agent 协作规范 | [AGENTS.md](AGENTS.md) |
| AI 使用与过程记录 | [AI_USAGE.md](AI_USAGE.md) |

前端代码按 app、features、navigation、shared 分层，各层 AGENTS.md 和 doc/README.md 说明职责与接口。提交使用英文 Conventional Commits，分支按项目负责人安排。
