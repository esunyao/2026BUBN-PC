# Hero 实现说明

## 数据与状态

Vue 3 Composition API 与现有 pnpm / Vite / TypeScript 工程保持一致，没有引入新状态库或 3D 引擎。app/useMemories.ts 是运行中的单一状态源，memoryDemo.ts 创建两套事件、四个场景、十一个时刻及 34 份贡献。shared/memoryTypes.ts 定义标准化关联；所有视图使用相同 contribution ID。历史地图、导航、回放与 useTrip 保留在源码中，主入口不再挂载它们。原 importPhotos.ts 继续承担格式验证和真实 EXIF 提取。

## 动画与返回

SpatialPhotoStack 在人物切换时保留相纸 DOM，CSS perspective / transform / opacity 在 850ms 内连续移动；左右键与轻扫选择照片。PerspectiveExperience 在 Focus → Shared 时保留当前主图元素，宽度与深度过渡 750ms，其他作者照片从后景进入，文字延迟出现。作者、原文和照片始终来自同一贡献。弹层关闭保持时刻与 Lens；Esc、焦点圈定和 inert 保护底层控件。reduced-motion 关闭视差并缩短转场。

时间轴按 Scene 的 momentIds 驱动，确定性 tick 3500ms，2x 为 1750ms；到末尾暂停。两组 Then & Now 均为 sideBySide，图片不对齐时不冒充精准擦拭。wipe 分支已支持鼠标、触摸及键盘 range，但当前演示无对齐素材，不启用。

## 环境与性能

EnvironmentRecipe 组合低分辨率照片底图、SVG 纸/亚麻/石/丝绒纹理、定向柔光、最多两个 SVG 装饰和微视差。coastal / alpine / urban / ceremony 四套预设及 neutral fallback；灯光随时刻变化。主题预览不改变真实照片颜色。原图最大 1200px，底图 360px，索引缩略图 240px；非主图 lazy load。不进行人脸识别、心理推断或真实 AI 调用。

## 本地输入与边界

用户文字原样保存。Blob 保存于 IndexedDB，数据与 ID 引用保存于 localStorage；恢复后重新创建 object URL，替换图片与卸载时释放 URL。JSON 导入进行类型、ID、关联和 URL 范围校验，环境只允许本地白名单预设；文本以 Vue 插值显示。编辑可以改派人物与时刻；跨时刻移动会移除不再成立的手工交汇关联。缺图、缺 EXIF、存储失败均有说明。

Home 支持创建本地事件与导入/导出存档。创建入口初始化第一章和今日时刻；完整章节/参与者管理、登录、远程同步与对象存储尚未实现。JSON 不携带原始照片，跨浏览器导入需重新选择缺失文件。图谱为确定性坐标，Moment 与 Contribution 节点可点击，支持目录模式、拖动与缩放。

## 后端与未来导航

保留 backend/Archipelago 的 Kotlin/Spring 架构，本轮没有改动后端。features/import/analyzeMedia.ts 为 disabled/manual 接口，未来客观媒体分析通过 adapter 对接服务端；API key 不进入前端。未来沙盘仅替换 Event Overview 导航，继续发出 sceneId/momentId，不重写 Scene。

## 验证

23 项 Vitest（含旧导入、导航、回放测试）通过；lint、format:check、type-check 和生产构建检查见本轮日志。真实浏览器验证 Home/Event/Scene、人物/Focus/Shared/第三人切换、2x 回放、跨月对照、图谱拖动/缩放/跨场景跳转、390px 无横向溢出，以及照片/文字/心情保存后刷新恢复。Java 运行时缺失，后端构建未验证。

## Discovery 增量架构

MemoryData → indexMemory（先过滤 visibility）→ Detector registry → stable signature 去重 → 规则等级排序 → viewer 反馈 → Discover/Scene/Timeline/Constellation。同步 computed 仅随数据/viewer/反馈变化重算，不会被旧异步结果覆盖。“不是你上传的”是 Unseen 判据，不声称现实中没见过；tagsConsent + participantTags 才能显示自愿身份标注。Discovery 不显示模型自报百分比。

实现 same_moment、unseen、gap、scene_evolution；backstage 为手工阶段 Demo，thread-contract 返回空数组。每个时刻最多推荐一个不同素材的新视角。补写不改变 gap finding ID，每份原文独立署名；删完最后一份原文时移除空 Moment，Timeline 恢复 gap 标记。私密文字不通过人数/目录泄漏。

旧 Hero 浏览器存档增量补齐 Demo 时间范围和时刻，保留已编辑贡献。真实上传用 EXIF，缺时戳时仅使用用户指定 Moment 的近似时间；未知时间不参与交汇/Gap。JSON 导入校验时间、标签与可见性，用户文本只以插值渲染。

返回 Discover 保存 Scene 原状态和滚动位置；history 保存 primitive memoryView，URL 定位事件/场景/时刻/发现。失效、隐藏或无权限发现显示通用说明。后端遵循既有 Kotlin/Spring 架构，仅通过 ImageAnalysisProvider/数据仓库 adapter 接入，具体字段与任务在 BACKEND_COLLABORATION.md。
