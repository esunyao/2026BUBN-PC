# 后端配合契约：共同记忆与 Discovery

协作对象：仓库开发者 @esunyao。前端分支 `feat/shared-memories-hero`，Hero 基线 `a7090d7`。本轮前端使用本地规则与 Mock，可先独立演示；后端按现有 Kotlin / Spring Boot / Java 21 / SQLite 架构增量实现，不要求迁移技术栈。当前没有真实模型推理、账号鉴权或远程素材存储。

## 先对齐字段，再实现服务

- 现有数据 DTO：`frontend/src/shared/memoryTypes.ts`。Event → Scene → Moment → Contribution 均使用稳定 ID，任何业务视图不复制素材数组。
- 时间需提供 start/end、precision（exact/approximate/date-only/unknown）、source（exif/user/vision-model/demo）。无 EXIF 不以文件修改时间伪造拍摄时间。活动 startAt/endAt 用于有界 Gap 检测。
- 原文 writtenText 必须原样保存；owner/participantId 不由模型猜测。participantTags 只能保存自愿标注，同时保留 tagsConsent 及实际授权记录；默认不开启人脸身份识别。
- visibility 支持 private / event-members / public，后端根据登录用户和事件成员校验，不能相信前端传入的 viewerId 或 participantId。当前 Demo 身份切换只是演示，不能用于生产鉴权。
- 文字时刻支持 `Moment.originGapId`、`endAt`，同一 gap 只有一个时刻，多人贡献分别保存和版本化。只允许作者编辑/删除自己的文字。

## 建议按这三个可验证阶段配合

1. **素材和原文仓库**：提供事件/场景/时刻/贡献读取、上传照片及缩略图、保存原文、作者编辑/删除。客户端临时 ID 可直接使用 UUID；服务端应处理重复请求。可建议 `GET /api/v1/events/{eventId}/memory-index` 返回授权可见的 MemoryData；`POST /api/v1/events/{eventId}/contributions` 保存贡献，`PATCH/DELETE /api/v1/contributions/{id}` 严格检查作者。时间范围、成员资格、可见性要服务端验证；private 数据不得通过标题、数量或 URL 泄漏。
2. **一个多模态分析入口**：`POST /api/v1/media/analysis` 以 contributionIds 申请批量分析，服务器取得授权缩略图后调用同一个模型；长任务返回 jobId，查询进度/结果。结果结构必须匹配 `ImageAnalysisProvider`，不是自由文本，见下方示例。返回 modelId/version，服务端缓存到媒体摘要/版本键，重试和失败独立于用户原文。
3. **发现及反馈同步**：先让前端规则消费服务端 MemoryData/analysis。前端 Detector、排序和去重保持厂商无关，后续可移植到后端。反馈使用 viewer + findingId（stable ID），confirmed/dismissed/favorite 分开保存；发现读取与反馈写入都先鉴权。不得为每条发现独立调用模型。

以上路径是拟定协作契约，当前后端尚未实现。可以在 Issue 中提出按现有服务模块调整路径，但字段语义必须保持。

## ImageAnalysisProvider 对接点

TypeScript 契约在 `frontend/src/features/discovery/types.ts`：

```ts
analyze(
  images: Array<{ id: string; thumbnailUrl: string }>,
  context: { eventId: string; signal?: AbortSignal },
): Promise<Array<{ contributionId: string; analysis: MediaAnalysis }>>
```

生产 adapter 调用服务端，不接受任意远程 URL 作为服务端抓取地址。后端只根据授权 contributionId 查本方媒体；必须校验图片尺寸/格式/大小，所有模型 Key 留在服务端环境。

服务端结果示例：

```json
{
  "contributionId": "server-media-uuid",
  "analysis": {
    "sceneTags": ["stage"],
    "objects": ["curtain", "microphone"],
    "activities": ["performance"],
    "phaseTags": ["performance"],
    "summary": "画面中有舞台、帷幕和麦克风。",
    "modelId": "configured-server-model",
    "version": "1"
  }
}
```

用服务端 JSON Schema 校验结构和长度；summary 只允许客观可见观察。不要返回第一人称感受、动机/心理推断、人脸身份或模型自报百分比。Thread 只能依据真人确认的同一具体物体标注，相同类别不等于同一物品。前端目前 `MockVisionAnalysisProvider` 仅返回 Demo 的手工标注，用户上传没有伪模型结果。

## 集成验收

- 服务端私密照片不能被另一个用户读出，任何 Findings 的关键证据不可见时整体隐藏或基于可见素材重建。
- 缺时戳/跨日/事件范围外不能生成确定 Gap；默认本地采用 Shanghai 时区、60 分钟阈值、240 分钟上限、每事件最多 3 个。服务端可以返回明确时区配置，不能悄悄改变含义。
- A/B 为同一 originGapId 保存原文，刷新读回后仍分作者；A 无法编辑或删除 B；删除后关联与状态重算。
- 分析重复提交不重复收费；取消/过期任务不会覆盖新版本。原文不会被分析结果改写。
- 提供契约 fixture 与 Kotlin 单元/HTTP 测试；前端使用同一 fixture 校验 Normalization/Detector。

后端开发请主要改 `backend/Archipelago/` 与本契约的接口讨论，前端工作由当前分支持续推进。合入前双方同步 DTO 与示例 JSON，避免前端与后端各造一套模型。本机缺少 Java 运行时，尚未执行后端 Gradle 验证；请后端开发者在 Java 21 环境运行 `./gradlew test build` 并贴结果。
