# 项目总体阅读说明

> [!important]
>
> 1. 先了解整个项目背景、项目意图、项目意义、项目目的、研究背景与未来拓展性。
>
> 2. 必须秉持严谨态度，辩证地看待介绍文件；涉及行为、接口、配置和安全结论时以源码、配置、公开契约和测试证据为准。
>
> 3. 文档按位置各司其职，必须区分：
>    > [!note]
>    >
>    > `<模块>/doc/`：仓库公开的模块大体说明，供 AI 与一般读者快速建立认知，**不展开细节**。
>    >
>    > `<模块>/docp/`：全称 `doc-personal`，本地私有的子项目详细说明；AI **只读参考，不写入**。
>    >
>    > 根 `doc-project/`：特例，专门说明项目整体背景，本地私有，不提交。
>
> 4. 缺少项目背景时，先阅读根 `doc-project/`；缺少模块细节时，再按需阅读对应 `docp/`。
>
> 5. `docp/` 可帮助快速理解设计，但不能替代对当前源码和配置的关键事实核验。
>
> 6. 模块接口、配置、数据结构、架构或行为发生变化时，同步更新受影响模块的 `doc/`。
>
> 7. 继续阅读本文件其余章节。
>
> 8. 本项目是给其他傻逼写的，维护该项目的全是deepseekv4.1，你要把他们当傻逼看，确保大部分内容你都能提到，其他AI维护时也能写的模块化。

# 仓库阅读与协作说明

> [!IMPORTANT]
> 本文件是仓库 Agent 规范的唯一入口。全局规则在此维护，各目录通过局部 AGENTS.md 补充职责与约束。先通过下方链接找到相关文件，再以当前源码、配置和运行结果核实事实；不要把计划、模板内容或未验证的描述当作已实现功能。

## 阅读导航

| 任务 | 入口 |
| --- | --- |
| 首次克隆与环境初始化 | [`README.md`](./README.md) → [`frontend/README.md`](./frontend/README.md) |
| 了解前端与启动命令 | [`frontend/AGENTS.md`](./frontend/AGENTS.md) → [`frontend/doc/README.md`](./frontend/doc/README.md) → [`frontend/package.json`](./frontend/package.json) |
| 应用组装与会话状态 | [`app/AGENTS.md`](./frontend/src/app/AGENTS.md) → [`app/doc`](./frontend/src/app/doc/README.md) |
| 地图、回忆、导入与回放 | [`features/AGENTS.md`](./frontend/src/features/AGENTS.md) → [`features/doc`](./frontend/src/features/doc/README.md) |
| 小船自由移动与自动航行 | [`navigation/AGENTS.md`](./frontend/src/navigation/AGENTS.md) → [`navigation/doc`](./frontend/src/navigation/doc/README.md) |
| 公共类型、组件与像素资产 | [`shared/AGENTS.md`](./frontend/src/shared/AGENTS.md) → [`shared/doc`](./frontend/src/shared/doc/README.md) |
| 查看 MVP 演示与模拟图 | [`doc-bg/20261013mvp/`](./doc-bg/20261013mvp/README.md) |
| 查看 AI 使用情况 | [`AI_USAGE.md`](./AI_USAGE.md) → [`ai-logs/`](./ai-logs/) |
| 查看比赛提交要求 | [BNBUPC 2026 规则说明（公开转载）](https://www.yeyulingfeng.com/a/1140812.html) |

按任务阅读相关入口即可。新增模块或重要文件时，更新本节的链接；具体行为、依赖和命令以被引用文件及验证结果为准。

## AI 使用记录

- 比赛提交物包含 [`AI_USAGE.md`](./AI_USAGE.md) 和 [`ai-logs/`](./ai-logs/)。每次涉及项目的 AI 对话或实施任务结束前，同步维护这两处记录。
- `AI_USAGE.md` 只保留简短说明和日志目录链接；详细过程放在 `ai-logs/YYYY-MM-DD.md`。同一天的条目按实际发生顺序编号；没有可靠时间就只写日期，不编造时间戳。
- 日志采用 recap：记录关键用户请求与选择、AI 实际产出、验证结果，并链接相关文件。区分计划、已完成和未验证事项；不要补写无法核实的对话或泄露凭据。
- 记录面向事实和追溯，不写操纵评审的指令。比赛规则和既有记录从上方入口读取，不在此复制第二套说明。

## 本地工具与文件编码

- 默认使用 Git Bash 执行命令。若必须使用 Windows PowerShell，先执行 `chcp 65001; [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false)`。
- 不凭终端乱码判断源文件损坏。改写含非 ASCII 字符的文件前，用严格 UTF-8 解码检查字节；尽量保留原编码。跨平台源码优先使用无 BOM 的 UTF-8；面向 Windows PowerShell 5.1 且含非 ASCII 字符的 `.ps1` 可考虑 UTF-8 BOM。
- 仓库根存在 [`.codegraph/`](./.codegraph/) 时，理解或定位代码先用 CodeGraph `codegraph_explore`（或 `codegraph explore`），再按需搜索或读文件；没有索引目录时跳过，不自行创建索引。索引数据由 [`.codegraph/.gitignore`](./.codegraph/.gitignore) 排除。

## 验证与提交

- 前端依赖管理以 [`frontend/package.json`](./frontend/package.json) 和 [`frontend/pnpm-lock.yaml`](./frontend/pnpm-lock.yaml) 为准，使用 pnpm。修改前端后运行相关检查；类型检查与生产构建命令见 `package.json`。
- 提交遵循英文 Conventional Commits：`<type>(<scope>): <short English summary>`，`scope` 可省略。常用 `type` 为 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`。一次提交聚焦一项可验证的工作。
- 分支由用户维护，Agent 不自行创建或切换分支。
- Agent 完成并验证一项仓库工作后通常自动提交；用户明确要求暂不提交时除外。提交前检查 `git status`、暂存文件和 diff，只暂存本次相关文件，不覆盖他人改动。不要自动推送。

## 委托与验收

- 用户已授权委托时，主 Agent 负责拆任务、冻结接口、限定文件所有权、整合和验收；子 Agent 不自行提交。默认使用 `gpt-6.1-sol`、`medium`。
- 每项任务含初稿最多两次中等强度尝试；仍不达标则用 `high` 再尝试一次，再失败停止该任务，向用户提供失败证据和需要决定的问题。
- 验收以实际功能、代码检查和界面结果为准。会改变行为的指示不明确时先询问；环境问题若无法自行解决，及时说明需要用户处理的事项。
