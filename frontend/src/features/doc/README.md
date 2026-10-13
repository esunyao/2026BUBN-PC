# 功能模块

hero/ 包含照片堆叠、MemoryImage、Focus/Shared、ThenAndNow、SceneTimeline、MemoryConstellation、AtmosphereEngine 与可访问弹层。所有组件通过 props/events 读取应用数据，不拥有独立全局事件数组。import/importPhotos.ts 仍用于真实图片验证与 EXIF 解析；analyzeMedia.ts 明确为 manual/disabled 预留接口。

world/memories/replay/ImportPanel 的旧原型源码保留，当前主入口不挂载。图谱用固定坐标，不引入重型渲染引擎。样例文字不会被当成真实用户情感。

discovery/ 实现 index/registry/privacy/dedupe/rank、Detectors、DiscoverPage 与 MockVisionAnalysisProvider。Unseen 复用 Hero 相纸，Timeline/Constellation 引用同一 Findings。

import/eventGrouping.ts 提供时间、固定位置锚点与图片特征的候选事件归类；候选需用户确认，不把相似照片自动当作同一真实事件。

PhotoEventImport.vue 负责候选审阅；photoAnalysis.ts 在浏览器提取真实 MobileNet 图片向量，importEvents.ts 构造已确认事件，app 负责一次性提交。legacy analyzeMedia.ts 仍是预留接口，不代表新图片嵌入功能未实现。

chapterImport.ts 构造篇章内事件及待整理照片；chapterCandidates 对可信时间和未知时间分别归组。PhotoEventImport 默认自动生成并提交，手动审阅为可选。

2026-10-13：MemoryManager 以 typed props/emits 提交整理操作。物品跨事件线索仅使用明确用户或 Demo 标注，星图虚线连接发现与证据，可点击跳转；人物标签需确认同意。对照默认并排，用户确认构图对齐后使用 wipe。
