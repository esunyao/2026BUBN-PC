# 前端总览

这是 Vue 3 + TypeScript + Vite 的单页演示。入口是 main.ts → app/App.vue，状态在 app/useTrip.ts。浏览器本地解析照片，不依赖后端；刷新恢复虚构示例，导入内容只留在当前会话。

## 目录与依赖

- [app](../src/app/doc/README.md)：组装页面、示例旅行和唯一会话状态。
- [features](../src/features/doc/README.md)：地图、回忆、图片导入、时间回放。
- [navigation](../src/navigation/doc/README.md)：小船位置、键盘控制、自动航行。
- [shared](../src/shared/doc/README.md)：共用类型、像素组件、计算和主题。

app 依赖 features/navigation/shared；功能通过 props、事件和注入函数协作。shared 不依赖业务模块。地图坐标是艺术布局，GPS 只用于地点归并，不能把两者混用。

## 使用顺序

1. 点击岛屿，小船抵达后打开回忆。
2. 切换同行人物，比较同地点的照片；点击照片查看大图。
3. 播放或拖动时间条，按顺序重走旅程。
4. 地图获得焦点后用方向键或 WASD 自由驾驶；手动控制会中断回放。
5. 导入照片，先选本批拍摄者；没有 GPS 的图片可手动安放到已有岛或新岛。

日夜主题使用同一地图。导入支持可显示的 JPEG、PNG、WebP；无法显示的文件逐个报错，其他文件继续。人物筛选不改变地点布局。

## 验证入口

命令见 [package.json](../package.json)；从 frontend 执行 lint、format:check、test、type-check、build。逻辑测试覆盖照片归组、动态布局、导航取消与海岸阻挡、回放时钟和会话归属；真实浏览器验收结果见 [验证记录](verification.md)，截图见 [MVP 记录](../../doc-bg/20261013mvp/README.md)。不要用单元测试替代真实图片导入或视觉验收。
