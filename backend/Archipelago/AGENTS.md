# Archipelago 阅读与修改入口

规范来源：[仓库 AGENTS](../../AGENTS.md) → [后端入口](../AGENTS.md)。本文件说明导航和本模块边界，不复制全局规则。

## 阅读顺序

| 任务 | 入口 |
| --- | --- |
| 初始化、配置及运行 | [README](README.md) → [.env.example](.env.example) → [配置](src/main/resources/application.yaml) |
| 模块与数据流 | [doc 总览](doc/README.md) |
| 字段与 HTTP 契约 | [OpenAPI](doc/openapi.yaml) |
| SQL 数据结构 | [数据库说明](doc/database.md) → [迁移](src/main/resources/db/migration/V1__create_world.sql) |
| 登录、OIDC 与 JWT | [auth 入口](src/main/kotlin/cn/commonagora/world/auth/AGENTS.md) |
| 事件、拍摄者和地点 | [event 入口](src/main/kotlin/cn/commonagora/world/event/AGENTS.md) |
| RustFS 直传及预签名 | [media 入口](src/main/kotlin/cn/commonagora/world/media/AGENTS.md) |
| 配置和公共接口 | [config 入口](src/main/kotlin/cn/commonagora/world/config/AGENTS.md) → [shared 入口](src/main/kotlin/cn/commonagora/world/shared/AGENTS.md) |
| 验证证据及未验证项目 | [verification](doc/verification.md) |

## 修改边界

- 维持单进程、SQLite 单连接池；RustFS 网络请求不能包在数据库事务里。
- API 用户身份只来自已验证的 JWT；不信任请求中的账号 ID 或自定义身份头。事件权限检查在预签名之前完成。
- 图片字节只直传 RustFS；数据库保存元数据和 object key。不能增设后端文件上传／代理下载接口。
- 公共 DTO 与异常由 shared 维护；event 和 media 通过 EventAccess 协作，不建立相互依赖。
- 改字段先核对 OpenAPI 和迁移，随后同步 database.md；新增迁移，不修改已部署的版本。
- .env、数据文件、密钥及实际凭据禁止提交；docp 和根 doc-project 只读，不写入。
- 每次功能改动运行相关 Gradle 测试；交付运行完整 test 和 build。子 agent 不提交；主 agent 统一验证并分批提交。
- 当前前端未接入后端，用户要求本轮不能修改前端，不把未来联调方案描述为已实现。
