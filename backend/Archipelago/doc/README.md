# 后端总览

## 做什么

一个共同事件由创建者维护多个拍摄者标签和图片。后端负责账号登录、事件权限、地点归组、SQLite 元数据和 RustFS 预签名；地图、过滤和回放属于前端。当前前端未接入这些接口。

## 模块与数据流

| 模块 | 输入 | 输出／职责 |
| --- | --- | --- |
| [auth](../src/main/kotlin/cn/commonagora/world/auth/AGENTS.md) | 演示账号、OAuth 授权请求 | OIDC 和 Access Token；用户 subject 为账号 UUID |
| [event](../src/main/kotlin/cn/commonagora/world/event/AGENTS.md) | 已验证身份、事件和照片位置 | 仅本账号事件、拍摄者标签、固定锚点及稳定岛屿布局 |
| [media](../src/main/kotlin/cn/commonagora/world/media/AGENTS.md) | 本账号图片意图及 photoId | RustFS 直传地址、确认照片、短期读取地址 |
| [config](../src/main/kotlin/cn/commonagora/world/config/) | .env／环境变量／可选 Nacos | 类型化配置、SQLite 和签名密钥 |
| [shared](../src/main/kotlin/cn/commonagora/world/shared/) | 公共字段和业务异常 | DTO、EventAccess、照片行映射、Problem Detail |

流程：授权码 + PKCE 登录 → 创建事件 → 添加拍摄者 → 申请上传 → 浏览器 PUT 到桶 → 确认 HEAD/COPY/HEAD → 元数据 READY → 加载事件与 GET 预签名。

数据库事务只处理元数据。确认的正式对象与临时上传对象分离，旧 PUT 地址不能改写已发布回忆。无 GPS 的 READY 照片等待手动安放；PENDING 照片不出现在快照中。

## 进一步阅读

- [运行和配置](../README.md)：环境、开发命令与 RustFS 准备。
- [数据库](database.md)：所有字段、关系、约束与状态。
- [OpenAPI](openapi.yaml)：对外 HTTP 契约。
- [验收记录](verification.md)：实际检查结果及外部环境缺口。
- [协作契约](implementation-contract.md)：本轮 agent 接口分工，不能替代源码事实。
