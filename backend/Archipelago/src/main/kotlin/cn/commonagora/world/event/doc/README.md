# 事件、拍摄者与群岛

上游入口：[后端实施契约](../../../../../../../../doc/implementation-contract.md)、[公共类型](../../shared/Contracts.kt)、[数据库迁移](../../../../../../resources/db/migration/V1__create_world.sql)。

EventController 提供事件列表、创建、快照、添加拍摄者和照片手动归属接口。所有者由 JWT subject 提供；非本人或不存在资源统一返回 404。名称去除首尾空白并限制长度，拍摄者颜色采用六位十六进制。

EventService 实现 EventAccess，供照片确认事务调用。GPS 缺失时照片暂不归组；有效 GPS 与地点固定锚点按球面距离比较，300 米以内选最近地点，相同距离按既有槽位顺序。新地点追加槽位；地图每行四列，外观为 slot % 10，已有地点不会因新增而移动。

手动归属只接受 READY 照片，必须提供现有 islandId 或非空 newPlaceName 中的一项。新地点以该照片 GPS 为锚点，可为空。事件快照按导入顺序返回 READY 照片，保留缺失 GPS 与时间，不携带图片 URL。

EventServiceTest 使用临时 SQLite 数据库及正式迁移，覆盖所有权、固定锚点距离、稳定位置、空元数据、手动归属、跨事件外键和重开持久化。验证状态以主 agent 的构建记录为准。
