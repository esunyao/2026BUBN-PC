# Event 模块

遵循[根规范](../../../../../../../../../AGENTS.md)与[实施契约](../../../../../../../doc/implementation-contract.md)。

- Controller 仅从 JWT subject 取得用户 ID；Service 负责资源所属关系、输入校验、事务和归组；Repository 使用显式 Spring JDBC SQL。
- EventAccess 是 media 调用边界。assignIsland 必须加入调用方确认事务；不要把存储网络请求加入数据库事务。
- 地点固定首张照片 GPS 锚点，300 米内选最近，距离相同时按持久化 slot；新地点使用 MAX(slot)+1。位置与外观由 slot 推导，不能按当前总数重新布局。
- 事件快照只返回 READY 照片，保持 import_order，未知 GPS/拍摄时间保持 null。照片 URL 由 media 提供。
- 数据结构变化先协调 shared/迁移的维护者；同步[模块说明](doc/README.md)。SQLite 集成测试位于 src/test/kotlin/cn/commonagora/world/event。
