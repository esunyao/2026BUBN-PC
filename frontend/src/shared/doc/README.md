# 公共代码

memoryTypes.ts 定义 Hero 标准化实体与 EnvironmentRecipe；lib/memoryStorage.ts 保存/读取 IndexedDB Blob；styles/hero.css 提供温暖编辑式视觉、响应式与 reduced-motion。类型与存储不依赖 app/features。

旧 types.ts、GPS/布局工具、像素 UI 与 theme.css 留存供原有地图模块和测试使用。

Contribution 扩展 TimeEvidence、visibility、participantTags/tagsConsent 和客观 MediaAnalysis；Moment 支持 originGapId/endAt。用户原文不与 analysis.summary 混用。

memoryStorage.storeMediaBatch 将同批照片写入一个 IndexedDB 事务；归类算法与模型保持在 features/import。

MemoryData.pendingPhotos 可选，旧存档兼容；待整理记录有篇章/作者关联，不能伪造 momentId。原始 HEIC 与显示预览分别保存。

2026-10-13：MediaAnalysis.source 标记标注来源，MemoryManagementAction 为整理界面的类型化命令。新增字段兼容旧存档。
