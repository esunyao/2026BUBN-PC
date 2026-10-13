# SQLite 数据结构

## 总览

后端保存账号、事件、记忆图和图片元数据，文件内容在 RustFS。结构事实来源是 [V1](../src/main/resources/db/migration/V1__create_world.sql)、[V2](../src/main/resources/db/migration/V2__online_memory_graph.sql)、[V3](../src/main/resources/db/migration/V3__demo_feedback.sql) 迁移，不改已执行版本。

关系：`users → events → participants / places / photos`。每张照片引用同一事件的拍摄者和可选地点。所有 ID 为 UUID 字符串；时间字段是 UTC Unix 毫秒，不保存本地时区字符串。

Flyway 另维护 flyway_schema_history 记录已执行的迁移版本和校验值，它不是业务表；备份与恢复需连同数据库保留。

SQLite 配置启用外键、WAL 和忙等待；单连接池串行执行数据库事务。RustFS 网络请求在事务外执行，确认成功后用短事务分配地点和修改照片状态。

## users：登录账号

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| id | TEXT | 否 | 主键，也是 Access Token 的 subject |
| username | TEXT | 否 | 唯一登录名 |
| password_hash | TEXT | 否 | 密码哈希，不保存明文密码 |
| created_at | INTEGER | 否 | 首次建档时间 |

本地配置可预置演示账号，重新启动不覆盖密码。注册账号使用唯一用户名和邮箱；credential_scheme 标识旧密码哈希或 SHA-256 摘要再 BCrypt 的版本。邮箱不验证，没有密码找回接口。

## events：共同事件

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| id | TEXT | 否 | 主键 |
| owner_id | TEXT | 否 | 外键，指向 users.id |
| name | TEXT | 否 | 事件名称 |
| created_at | INTEGER | 否 | 创建时间 |

索引 `idx_events_owner(owner_id, created_at)` 服务于当前账号的事件列表。所有业务查询先校验创建者，不按客户端传入的账号 ID 授权。

## participants：拍摄者标签

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| id | TEXT | 否 | 主键 |
| event_id | TEXT | 否 | 外键，指向 events.id |
| name | TEXT | 否 | 显示名 |
| initials | TEXT | 否 | 头像简称，由显示名前两个字符生成 |
| color | TEXT | 否 | 六位十六进制颜色 |

拍摄者由事件创建者录入，不是登录账号。`UNIQUE(event_id, id)` 用于照片的复合外键约束；删除事件时标签随之删除。

## places：稳定的地点岛屿

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| id | TEXT | 否 | 主键，接口称 islandId |
| event_id | TEXT | 否 | 外键，指向 events.id |
| name | TEXT | 否 | 自动地点名或用户手动名称 |
| slot | INTEGER | 否 | 事件内唯一的非负布局槽位 |
| latitude | REAL | 是 | 固定锚点纬度，范围 -90～90 |
| longitude | REAL | 是 | 固定锚点经度，范围 -180～180 |

经纬度必须同时为空或同时存在。锚点来自首次归入该地点的照片，不随后续素材移动；300 米内选最近地点，否则分配下一个槽位。无 GPS 手动新建地点可没有锚点。

唯一约束：`(event_id, id)`、`(event_id, slot)`。接口按槽位计算位置和 `slot % 10` 外观，不额外存储同一套派生值；新增地点不会移动已有地点。删除事件时地点随之删除。

## photos：图片与上传状态

| 字段 | 类型 | 可空 | 说明 |
| --- | --- | --- | --- |
| id | TEXT | 否 | 主键，也是上传确认使用的 photoId |
| event_id | TEXT | 否 | 外键，指向 events.id |
| photographer_id | TEXT | 否 | 同事件拍摄者 ID |
| island_id | TEXT | 是 | 同事件地点 ID；没有 GPS 且未安放时为空 |
| filename | TEXT | 否 | 原文件名，仅用于展示，不用于生成对象路径 |
| caption | TEXT | 否 | 照片说明，允许空字符串 |
| content_type | TEXT | 否 | JPEG、PNG 或 WebP MIME 类型 |
| declared_bytes | INTEGER | 否 | 申请上传时声明的正数大小 |
| verified_bytes | INTEGER | 是 | 确认时核验的大小；READY 时必须为正数 |
| staging_key | TEXT | 否 | 唯一临时对象 key |
| object_key | TEXT | 否 | 唯一正式对象 key，与临时对象不同 |
| upload_expires_at | INTEGER | 否 | 本次上传申请的截止时间 |
| status | TEXT | 否 | 只允许 PENDING 或 READY |
| latitude | REAL | 是 | 照片原始纬度 |
| longitude | REAL | 是 | 照片原始经度，与纬度共同存在或共同为空 |
| captured_at | INTEGER | 是 | EXIF 拍摄时间；缺少时不以文件修改时间替代 |
| import_order | INTEGER | 否 | 事件内唯一的非负导入顺序；申请上传时分配，失败可留下间隔 |
| created_at | INTEGER | 否 | 申请上传时间 |

### 状态与约束

- 申请预签名后写入 PENDING；图片在 RustFS 上传成功并不代表已经成为回忆。
- 确认流程执行 HEAD → COPY → HEAD，核验后以事务写入 READY。地点归组与状态修改同一事务提交。
- 事件快照和下载接口只读取 READY。重复确认 READY 返回已有照片，不重复增加地点或导入顺序。
- 过期未确认记录保留 PENDING，确认返回 410；临时文件由桶生命周期清理。首版不做数据库过期记录清理任务。
- `(event_id, photographer_id)` 和 `(event_id, island_id)` 是复合外键，阻止跨事件引用；事件删除会级联删除照片行。首版不提供删除事件接口，也不会由数据库级联删除 RustFS 文件。
- `UNIQUE(event_id, import_order)` 保证稳定顺序；`idx_photos_event_status` 支持快照，`idx_photos_place` 支持地点检索。

数据库不保存预签名 URL、Access Token、照片二进制或 GPS 反查的地址。照片只能通过当前账号有权访问的 ID 获取签名，不能传任意 object key 下载。

## 认证状态与运行文件

OAuth 客户端配置来自环境配置；授权码、授权状态及 HTTP 登录会话首版在内存中，重启后重新登录。RSA 签名密钥保存在独立的被忽略文件，不在 SQLite 中。

SQLite 数据文件及 WAL/SHM 附属文件不提交。备份运行中的数据库应使用 SQLite 备份能力，不能只复制主文件而忽略 WAL。

## V2/V3 在线记忆增量

准确字段、外键和索引以 V2、V3 迁移 SQL 为准。

| 表或新增字段 | 关系及用途 |
| --- | --- |
| users.email、credential_scheme | 邮箱唯一；记录凭据版本 |
| events.subtitle、event_type、start_at、end_at、revision | 篇章信息与数据版本 |
| participants.user_id、event_members | 关联展示署名与真实账号；成员主键为事件加账号 |
| photos.uploader_id | 记录实际上传账号；旧照片回填创建者 |
| memory_scenes、memory_moments | 章节、时刻、Gap 来源；同事件 Gap ID 唯一 |
| contributions | 原文、照片引用、实际作者、可见性和乐观锁版本；关联同一事件的时刻和署名 |
| memory_links、memory_link_moments、memory_link_contributions、memory_pairs | 交汇与 Then & Now 关联 |
| discovery_feedback、demo_discovery_feedback | 每账号的发现反馈；示例反馈单独保存 |
| memory_requests | 以账号和请求 ID 保证导入、复制重试幂等 |
| consent_audit | 可见性授权审计预留表 |

照片从 PENDING 到 READY 仍由原上传确认流程驱动。贡献只能引用已确认、当前账号有权使用的照片；创建使用稳定 ID，修改和删除检查 version。删除最后一份 Gap 原文时移除空时刻。V2 会为旧事件建立初始章节和时刻，把旧 READY 照片回填为贡献，保留对象引用。对象存储网络调用不在数据库事务中执行。
