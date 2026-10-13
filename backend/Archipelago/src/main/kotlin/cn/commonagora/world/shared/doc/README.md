# 公共类型与 HTTP 响应

上层入口：[后端 AGENTS](../../../../../../../../AGENTS.md)。

| 文件 | 职责 |
| --- | --- |
| Contracts.kt | 请求／响应 DTO、GPS、稳定岛屿和 EventAccess 边界 |
| PhotoRows.kt | JDBC 行到 PhotoDto 的共同映射；保留 null 时间和 GPS |
| CurrentUser.kt | 在资源服务器验证后取得非空 JWT subject |
| ApiException.kt | 带 HTTP 状态的业务异常 |
| ApiExceptionHandler.kt | Controller 异常转换为 Problem Detail，兜底不输出凭据或 SDK 细节 |

成功响应直接返回 DTO，不包第二层 data。API 认证过滤器发生的 401/403 在 auth 模块输出同样格式；OAuth 协议端点仍由框架输出标准 OAuth 错误。

EventAccess 由 event 实现，供 media 检查所有者、拍摄者和确认时分配地点。调用分配地点时必须已有数据库事务，不能从 shared 直接访问 RustFS。

验证入口：HTTP WorldApiTest、auth 集成测试、event 和 media 的实际 SQLite 测试；全部检查由后端根目录的 Gradle Wrapper 运行。
