# 前端总览

当前入口 main.ts → app/App.vue → useMemories.ts。Hero 通过规范化 Event/Scene/Moment/Contribution 实现 Home、章节、相纸堆叠、交汇、对照、时间轴、星图与环境。

[应用状态](../src/app/doc/README.md)、[功能组件](../src/features/doc/README.md)、[公共类型](../src/shared/doc/README.md)、[完整实现与边界](../../IMPLEMENTATION_NOTES.md)。历史地图/navigation/useTrip 保留供后续导航层参考，当前运行入口不挂载。features 通过 props/events 协作，不引入第二份全局状态。

新增 discovery/ 规则与发现页，从应用统一贡献状态派生 Findings；无照片时段以原文 Moment 表示。后端见 [契约](../../BACKEND_COLLABORATION.md)。

[2026-10-13 前端交付说明](DELIVERY-2026-10-13.md) · [简单 OpenAPI](2026-10-13.openapi.json)。

[照片事件归类 · 2026-10-13](PHOTO-GROUPING-2026-10-13.md)：批量导入、解释性分组、本地轻量画面分析与人工修正。

[初审交付入口 2026-10-13](SUBMISSION-2026-10-13.md) · [项目说明 Word](共同记忆项目说明_2026-10-13.docx)。

2026-10-13 后续交付：篇章自动导入、整理编辑、明确物品跨事件线索、手动多组对照、一步撤销及含原图备份恢复现可使用。完整备份总媒体上限100 MB；普通 JSON 仅含文字与配置。生产云同步/鉴权/DeepSeek接口接入仍由既有后端承接，见日期 OpenAPI。
