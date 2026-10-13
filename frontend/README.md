# 共同记忆前端

Vue 3 + strict TypeScript + Vite，沿用 pnpm 10.28.1；Node 范围以 package.json 为准（本轮使用 22.23.2）。

```sh
cd frontend
npm install -g pnpm@10.28.1
pnpm install --frozen-lockfile
pnpm dev
```

默认 http://localhost:5173，无需后端、数据库、账户或 API key。生产部署需为 /events/* 配置 SPA 回退至 index.html。

```sh
pnpm lint
pnpm format:check
pnpm test
pnpm type-check
pnpm build
pnpm preview
```

若终端仍命中旧 Node，使用 `type -a node npm pnpm` 检查 PATH，重新打开终端并使用已安装的新版 Node；Windows Git Bash 可将 `/c/Program Files/nodejs` 置于 PATH 前部。

## 演示路线

海陵岛之旅 → 海边漫步（日落默认时刻）→ 透过你的眼睛切换人物 → 点击相纸进入 Focus → 另一双眼睛进入交汇 → 切第三人/放大/返回 → 拖动或点击时间轴、播放及 2x → 元旦晚会 → 昨日与今日 → 星图节点目录/平移/缩放/跳回照片。环境按钮预览海边、山野、城市、晚会，随场景按钮恢复自动环境。

“留下记忆”支持新增与编辑原文、改派人物/时刻、心情、本地照片，复用 EXIF 解析。图片存于 IndexedDB，文本与配置存于 localStorage，刷新恢复；最大 12 MB，JPEG/PNG/WebP。无 EXIF 的时间位置保持未知，所属时刻由用户选择。创建篇章、JSON 导入/导出可使用；导出不含照片文件，跨浏览器缺图需重新上传。

## 代码与真实性

- app/memoryDemo.ts：两套事件的标准化 Mock；人物、日期、文字与关联为演示数据。
- app/useMemories.ts：统一运行状态、深链接和存储。
- features/hero/：照片、交汇、对照、时间轴、环境及星图组件。
- public/demo-assets/：本地真实摄影、低分辨率版本、SVG 纹理/装饰和 fallback。
- 原图来源和许可：[ASSET_CREDITS](../ASSET_CREDITS.md)。不代表真实海陵岛、同一地点或同一次活动。
- 架构与降级：[IMPLEMENTATION_NOTES](../IMPLEMENTATION_NOTES.md)。原地图模块留存，当前主入口使用 Hero。

没有真实 AI 推理、多人同步、服务端照片存储或 3D 地形重建；后台沿用仓库 Kotlin/Spring 架构，未来仅通过 adapter 接入。

## Memory Discovery 增量

入口 `/events/hailing/discover` 与 `/events/gala/discover`，支持 `?finding=<stable ID>` 深链。Home 数量、Scene 入口、Timeline 空白标记和星图发现入口来自同一 Findings。按类型、场景和记录者筛选，也可切换演示身份。

路线：日落 → 记忆发现 → 日落 Unseen → A/B/并看 → 查看依据 → 收藏/关闭/返回（保留人物、照片、主题、时刻、滚动位置）。尚未讲述 → 输入 1–500 字 → 保存 → 另一 Demo 身份为同一 gap 补写 → 两份独立原文 → Scene 文字时间节点/便笺/星图 → 刷新。晚会有准备/舞台/后台阶段及演出前 Gap。

`features/discovery/engine.ts` 先按权限过滤、建立 scene/moment 索引，再检测、去重、排序；`app/useDiscovery.ts` 协调反馈与原文。Gap 为明确事件范围内、同日 07:00–22:00、60–240 分钟、每事件最多 3 条，不以照片缺失断言重要事件。当前身份只能编辑/删除自己的 Gap 原文。Demo 身份切换不是生产鉴权，后端必须检查账号与事件成员权限。

MockVisionAnalysisProvider 仅返回 Demo 手工阶段标签；用户上传不调用模型。ImageAnalysisProvider 的批量契约见 [后端协作](../BACKEND_COLLABORATION.md)。Thread 仅契约，缺可靠同物体证据就不生成发现。当前保存可编辑版本，不提供历史版本 UI，生产审计由后端补齐。

验证为 30 项 Vitest、lint/format/type/build；浏览器验收见 [记录](doc/verification.md)。没有新增 Playwright 测试包，浏览器操作通过现有 CUA 的 Playwright locator 与原生截图接口执行。
