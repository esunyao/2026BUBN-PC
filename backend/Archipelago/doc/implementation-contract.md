# 后端实施契约

本文冻结各 agent 的协作接口；实际交付以 OpenAPI、迁移 SQL 与测试为准。

## 公共模型

源码入口：`shared/Contracts.kt`。事件快照含 event、participants、islands、photos；照片不含 URL，读取地址由 download-urls 批量获取。时间为 UTC 毫秒，ID 为 UUID 字符串。

## 模块边界

- auth：JWT subject 为 SQLite users.id，API authority 必须包含 SCOPE_world。预置演示账号；GET /api/v1/me 返回 id、username。
- event：实现 EventAccess；assertOwner 未找到或非本人均返回 404，assertParticipant 同样检查所属事件。assignIsland 在调用方数据库事务内执行；固定锚点 300 米归组、最近匹配、稳定槽位。
- media：PUT 签名记录 PENDING，confirm HEAD/COPY/HEAD 后以短事务将照片改为 READY 并调用 assignIsland；重复确认返回现有 PhotoDto。不在数据库事务里访问 RustFS。
- config：Spring Boot 4.1.0，Cloud 2025.1.2，Alibaba 2025.1.0.0；optional Nacos、关闭 discovery/刷新；SQLite 外键/WAL/单连接。存储参数通过 StorageProperties 提供。

## StorageProperties

包 config；data class 字段：enabled:Boolean=false、endpoint:String=""、publicEndpoint:String=""、accessKey:String=""、secretKey:String=""、bucket:String=""、region:String="us-east-1"、maxFileBytes:Long=20971520、uploadTtl:Duration=5m、downloadTtl:Duration=15m。绑定 world.storage。

## HTTP

业务前缀 /api/v1。事件列表为 EventSummary[]，创建事件返回 EventSummary，添加拍摄者返回 ParticipantDto。confirm 和 placement 返回 PhotoDto。成功直接 JSON，错误 Problem Detail。

状态：校验 400，未登录 401，权限/scope 403，非本人资源 404，过期上传 410，存储不可用 503。download-urls 每次 1–100 个照片 ID，全量鉴权后返回 DownloadResponse，不返回未确认照片地址。

## 文件所有权

主 agent：shared 公共契约、迁移、总文档/OpenAPI、接口验收和 Git。用户最新要求前端不得修改；前端联调改为接口测试。
认证 agent：build.gradle、config、auth、application 配置与 .env 模板；认证测试和局部文档。
事件 agent：event、事件测试与局部文档。
存储 agent：media、存储测试与局部文档。
子 agent 不提交、不切分支，不修改 HealthServer。
