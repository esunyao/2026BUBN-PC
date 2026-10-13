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
