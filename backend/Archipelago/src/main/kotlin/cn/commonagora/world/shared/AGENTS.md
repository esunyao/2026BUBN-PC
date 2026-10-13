# 公共代码入口

先读 [后端规范](../../../../../../../AGENTS.md) 和 [模块说明](doc/README.md)。

公共 DTO、EventAccess、照片行映射和 HTTP 异常只在此维护。shared 不依赖 auth、event 或 media；它们可以依赖 shared。增加真正复用的逻辑，不把只用一次的业务操作放进公共包。

改接口字段要同步后端 doc 中的 OpenAPI；改数据库映射要检查 SQL 迁移及 database.md。使用已验证 JWT 的 userId 扩展，不能从自定义身份头创建账号身份。
