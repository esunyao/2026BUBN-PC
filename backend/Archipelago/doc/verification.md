# 后端验证记录

日期：2026-10-13。用户本轮指定 Spring Boot 4.1.0，并要求前端不得修改；验收使用后端测试和实际 HTTP 请求，不代表当前前端已经联调。

## 已通过

| 检查 | 结果／证据 |
| --- | --- |
| 依赖与兼容性 | Boot 4.1.0、Cloud 2025.1.2、Alibaba 2025.1.0.0 解析成功；应用上下文和实际 jar 启动成功，未关闭兼容性检查 |
| 完整测试与构建 | Windows JDK 21.0.4 + Gradle Wrapper 9.7.1；gradlew.bat test build 成功，37 项测试、0 失败、0 跳过 |
| 认证协议 | 真实 CSRF 表单登录、S256 授权码、nonce、UUID subject、UserInfo、无 Refresh Token、授权码重放、错误密码／verifier、非法回调 |
| API 安全 | Cookie 不授权 API；ID Token、错误签名／issuer／audience、过期或缺少过期时间拒绝；scope、跨账号隔离、401/403 Problem Detail、CORS PATCH 预检 |
| SQLite | 正式 V1 迁移、外键、WAL、忙等待、单连接、回滚、重开持久化；GPS 必须成对，READY 必须核验大小 |
| 地点 | 固定锚点 299／301 米、最近匹配、相同距离稳定顺序、无 GPS 手动安放、第 50 个地点不移动已有地点 |
| 存储模块 | 实际 AWS SDK 签名、path-style、内外 endpoint、所需上传头；本地 HTTP 存储模拟及元数据测试验证 HEAD/COPY/HEAD、幂等、类型／大小、未确认及跨事件访问 |
| 可选 Nacos | 实际应用启用 127.0.0.1:1 的不可达 Nacos，optional 导入后正常回退启动；测试 fetch timeout=500ms，兼容性检查开启 |
| dotenv | 使用官方 Boot4DotenvEnvironmentPostProcessor 5.1.0，测试本地文件加载及系统环境变量优先；常规测试禁用开发者 .env，使用临时账号／密钥／数据库 |
| OpenAPI | Redocly CLI spec 规则校验成功；另核对 YAML 与全部本地引用，HTTP 闭环测试验证 DTO 字段、null 元数据及状态码 |
| 可执行 jar | world-0.0.1-SNAPSHOT.jar 在本地 18081 启动，以实际 HTTP 完成授权码交换、验证 ID Token 公钥签名、创建事件／拍摄者及读取快照 |
| 重启与退出 | 实际 jar 重启后事件、拍摄者、账号 UUID 和 RSA kid 不变；OIDC 退出返回注册地址并结束登录会话 |

## 测试入口

测试代码在 [src/test](../src/test/kotlin/cn/commonagora/world/)：

- auth：协议、JWT、密码初始化、密钥。
- config：SQLite、dotenv 优先级、存储参数和可选 Nacos 回退。
- event：所有权、地点、约束和持久化。
- media：签名与确认，远端调用使用模拟。
- integration/WorldApiTest：通过真实安全过滤器和 HTTP Controller 的业务闭环；桶是明确的测试替身。

```sh
./gradlew test build
pnpm --package=@redocly/cli dlx redocly lint doc/openapi.yaml --extends=spec --format=summary
```

第二条是可选的文档校验工具，需要 Node/pnpm；后端本身不依赖 Node。Gradle 测试报告位于 build/reports/tests/test/index.html，均为本地构建产物，不提交。

## 实际 RustFS 冒烟验证

用户创建配置桶后，使用本地 .env、隔离的临时 SQLite 数据库和真实应用 jar 完成一次实际存储闭环。样本为前端已有的 197,846 字节 WebP 图片；凭据、签名 URL 和真实 object key 未写入日志。

| 操作 | 结果 |
| --- | --- |
| OIDC 登录、创建隔离事件与拍摄者、申请上传地址 | 成功 |
| 直传 PUT、确认时服务端 HEAD/COPY/HEAD | 成功；确认后 GPS 地点已分配 |
| 重复调用确认 | 成功；照片和地点没有重复创建 |
| 签名下载与内容校验 | 成功；下载字节数和 SHA-256 与样本一致；事件快照仅含一张照片 |
| 测试对象清理 | 成功；本次 staging 与正式对象均已删除，随后 HEAD 返回 404；桶保留 |

跨域检查发现配置缺口：PUT 预检返回 HTTP 200，但响应没有匹配请求来源和方法的允许头；签名 GET 响应也没有允许来源头。因此 Node 直传验证通过，浏览器跨域直传／读取仍未通过验证，需在桶上配置正确的 CORS 规则。测试没有修改桶策略或 CORS 配置。

## 尚未验证

- 已部署 Nacos 的成功配置下载、namespace/group 与认证；已验证的是默认关闭及不可达时回退。
- 真实浏览器的登录回调、直传、下载及 URL 过期刷新：前端按用户要求保持未修改，尚未联调。
