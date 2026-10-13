# 初审交付入口 2026-10-13

## 启动与演示

在 frontend 运行 pnpm install --frozen-lockfile、pnpm dev。先用海陵岛和元旦晚会两套样例演示：人物切换 → Focus → 交汇 → 时间轴 2x → 昨日今日 → 星图 → Discover → 空白补写 → 刷新恢复。照片归类支持批量 EXIF/GPS/画面分组和可编辑自动标题简介。

## 材料与来源

- [项目说明 Word](共同记忆项目说明_2026-10-13.docx)：背景、方案、结构、相近产品、操作路线、当前状态与规划。
- [AI 使用说明](../../AI_USAGE.md) 和 [日志](../../ai-logs/2026-10-13.md)。
- [照片与许可](../../ASSET_CREDITS.md)、[归类说明](PHOTO-GROUPING-2026-10-13.md)、[日期 OpenAPI](2026-10-13.openapi.json)。
- 本地 MobileNet 只提取画面向量。DeepSeek 通过前端开发服务代理写策展草稿，最多每事件两张 JPEG 缩略图与日期；密钥在 Git 忽略的 .env.local，不进入浏览器或提交。静态生产环境需提供同源服务端接口。

## 相近方案与差异

Google Photos 提供共享相册与多人添加内容；Polarsteps 提供旅行跟踪与照片步骤记录。我们重点演示共同事件中的人物视角切换、多镜头交汇、可解释发现和无照片时段补写，不声称竞品完全没有相关能力或本作品是首创。来源：[Google 官方说明](https://blog.google/products-and-platforms/products/photos/share-with-google-photos/)；[Polarsteps 官方说明](https://www.polarsteps.com/travel-tracker)。

## 已完成与尚未完成

Hero、Discovery、本地输入和刷新持久化已实现。HEIC 增量支持 JPEG 预览及原文件保留，不同相机编码仍待更多实测。DeepSeek 已用真实图库缩略图返回有效标题/简介/说明；生成文字独立标注，失败回退本地。现有导入仍需审阅并保存候选。

“先建篇章、全量导入、篇章内自动拆事件、单张待整理、直接浏览”的统一流程是下一阶段，不在本轮宣称完成。Memory Threads、完整成员/章节管理、前后端登录和对象存储联调也未完成。后端框架未修改。

截图要求明确作品需可交互并说明 1–2 个相近方案；评审算法未知，不保证初审评分。提交以真实演示和明确边界为依据。
