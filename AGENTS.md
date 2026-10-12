# 仓库阅读与协作说明

> [!IMPORTANT]
> 本文件是仓库 Agent 规范的唯一入口。先通过下方链接找到相关文件，再以当前源码、配置和运行结果核实事实；不要把计划、模板内容或未验证的描述当作已实现功能。

## 阅读导航

| 任务 | 入口 |
| --- | --- |
| 了解前端与启动命令 | [`frontend/README.md`](./frontend/README.md) → [`frontend/package.json`](./frontend/package.json) → [`frontend/src/`](./frontend/src/) |
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
- 提交遵循 Conventional Commits：`<type>(<scope>): <简短摘要>`，`scope` 可省略。常用 `type` 为 `feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`build`、`ci`。一次提交聚焦一项可验证的工作。
- Agent 完成并验证一项仓库工作后通常自动提交；用户明确要求暂不提交时除外。提交前检查 `git status`、暂存文件和 diff，只暂存本次相关文件，不覆盖他人改动。不要自动推送。
