# 应用组装与状态

[App.vue](../App.vue) 组装 Home/Event/Scene 及各功能浮层；[useMemories.ts](../useMemories.ts) 是运行中的统一数据、路由、回放与存储状态；[memoryDemo.ts](../memoryDemo.ts) 提供两套示例。详见根 IMPLEMENTATION_NOTES.md。旧 useTrip/demoTrip 保留以兼容旧模块测试，主入口不调用。

useDiscovery.ts 与 useMemories.ts 组合，协调反馈、返回位置、多人 Gap 原文与作者约束；贡献仍只写入 useMemories.data。

照片归类由 features/import 产生候选，saveImportedEvents 校验记录者、保存 Blob，再更新单一 MemoryData；本地事件刷新时恢复到该事件有效 Demo 参与者。

篇章创建不再生成虚假今日时刻，直接进入整批导入。pendingPhotos 与事件照片共用 Blob 存储、恢复和存档剔除逻辑；仅本人待整理图片可手动收录。

2026-10-13：整理篇章支持篇章/人物/事件/时刻编辑、自己记录的移动与可见范围/时间修正/标签、手动对照创建与移除、一步撤销。无 EXIF 图片保持未知；用户修正不覆盖 capturedAt。同一时刻可信时间相近的多记录者上传支持交汇。
