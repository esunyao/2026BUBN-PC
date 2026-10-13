# Archipelago 后端

共同时刻世界的单节点后端，负责 OAuth/OIDC 登录、事件和拍摄者标签、SQLite 元数据，以及 RustFS 上传／读取预签名。图片字节不经过本服务。

前端已通过 OIDC 和  接入。接口以 [OpenAPI](doc/openapi.yaml) 为准；检查结果及未验证事项见 [验证记录](doc/verification.md)。

## 1. 初始化环境

需要 Git、JDK 21；Gradle Wrapper 已提供，不需要全局安装 Gradle。首次构建需要网络下载依赖。默认在本目录执行命令。

```sh
java --version
./gradlew --version
cp .env.example .env
```

已有 .env 时不要覆盖。编辑本地 .env，填入强初始密码 WORLD_DEMO_PASSWORD；新克隆的模板不包含密码。初次运行会创建并哈希演示账号；重新启动保留已有密码，修改环境中的初始密码不会重设数据库账号。

```sh
./gradlew test
./gradlew bootRun
```

Windows PowerShell／cmd 使用 .\gradlew.bat test 和 .\gradlew.bat bootRun。JAVA_HOME 必须指向 JDK 21；Git Bash／WSL 与 Windows 使用各自匹配的 Java 环境，不能用不同系统的旧 Java 启动 Wrapper。

默认监听 http://localhost:8080。访问 /.well-known/openid-configuration 可检查 OIDC 元数据；/login 是项目登录页。直接打开 /api/v1/events 不会凭登录 Cookie 获得访问权限，需使用授权码流程取得 Access Token。

## 2. 本地配置

配置由 [.env.example](.env.example) 和 [application.yaml](src/main/resources/application.yaml) 对照维护。开发目录中的 .env 自动加载；实际系统环境变量优先于同名 .env 值。部署使用环境变量，不把本地 .env 放进镜像或仓库。

| 配置 | 用途 |
| --- | --- |
| SERVER_PORT | 服务监听端口，默认 8080 |
| WORLD_DATABASE_PATH | SQLite 文件，默认 ./data/world.db |
| WORLD_DEMO_USERNAME / WORLD_DEMO_PASSWORD | 首次创建的演示账号 |
| WORLD_AUTH_ISSUER | 对外 OIDC 地址，必须与客户端校验的 issuer 一致 |
| WORLD_AUTH_REDIRECT_URI | world-web 唯一登录回调 |
| WORLD_AUTH_POST_LOGOUT_REDIRECT_URI | 唯一退出返回地址 |
| WORLD_AUTH_ALLOWED_ORIGIN | 允许调用 API 和令牌端点的浏览器来源 |
| WORLD_AUTH_KEY_PATH | 持久化 RSA 私钥文件路径 |
| WORLD_STORAGE_ENABLED | 是否启用 RustFS；默认 false |
| WORLD_STORAGE_ENDPOINT | 后端访问 RustFS 的 S3 地址 |
| WORLD_STORAGE_PUBLIC_ENDPOINT | 浏览器可达的 S3 地址，用于签名 |
| WORLD_STORAGE_ACCESS_KEY / WORLD_STORAGE_SECRET_KEY | 服务端专用存储凭据 |
| WORLD_STORAGE_BUCKET / WORLD_STORAGE_REGION | 已存在的私有桶及区域 |
| WORLD_STORAGE_MAX_FILE_BYTES | 默认 20971520，即 20 MiB |
| WORLD_STORAGE_UPLOAD_TTL / WORLD_STORAGE_DOWNLOAD_TTL | 默认 5m / 15m |
| NACOS_ENABLED | 是否加载 Nacos；默认 false |

RustFS 关闭时可以运行登录和事件功能，文件功能返回 503；开启后必须补全地址、凭据、桶及区域。前端公开配置不能包含存储密钥或登录密码。

## 3. 准备 RustFS

由维护者准备 RustFS 和私有桶，本服务不创建桶、不代理大文件，也不要求安装云端组件到本仓库。

1. 在 .env 配置内外两个 S3 endpoint 和专用访问凭据，启用 WORLD_STORAGE_ENABLED。公网部署使用 HTTPS。
2. 凭据仅授权该桶业务对象前缀的 PutObject、GetObject；HEAD 与桶内 COPY 需要相应的读取、写入权限。不要把管理员凭据交给浏览器。
3. 桶 CORS 允许实际客户端来源、PUT 和 GET，以及上传签名返回的请求头；按需要暴露 ETag。GET URL 可直接供图片元素使用。
4. 预签名必须使用最终访问地址；不能在签名后替换协议、域名、端口或路径。
5. 为临时前缀配置过期清理。对象路径为 owners/{userId}/events/{eventId}/staging/{随机值}；正式区为同事件的 photos/{随机值}。staging 生命周期应覆盖至少完整上传和确认窗口，不能清理正式区。

首版检查 MIME、扩展名及对象大小，不在后端下载图片解码或扫描。未确认、确认失败及超时记录不进入回忆快照；桶内可能存在未引用对象。首版不提供删除、孤儿扫描或清理调度，不能假定删除 SQLite 行会删除桶中对象。

RustFS 的 latest 标签可随时间变化。真实联调应记录部署镜像的版本或 digest；SDK 模拟测试不能证明目标 RustFS 实例兼容。

## 4. 登录和接口联调

公开客户端 ID 固定为 world-web；授权码流程必须包含 PKCE S256。scope 使用 openid profile world，接口 audience 为 world-api。通过 discovery 查找标准端点，不手写密码换令牌接口。

- 授权请求携带 response_type=code、client_id、注册的 redirect_uri、scope、state、nonce 和 PKCE challenge。
- 登录后用 code、同一个 redirect_uri 和 code_verifier 请求令牌端点，无 client_secret。
- 业务接口使用 Authorization: Bearer 后跟 Access Token。ID Token 和登录 Cookie 不可替代。
- Access Token 默认 10 分钟，无 Refresh Token。标准 OIDC 退出结束登录会话，已签发 JWT 仍可能到期前有效。
- 授权状态和登录会话在内存；业务数据和 RSA 密钥持久化，重启后重新授权。

业务顺序：POST /api/v1/events → POST /participants → POST /photos/presign → 浏览器 PUT → POST /photos/{photoId}/confirm → GET 事件快照 → POST /photos/download-urls。无 GPS 照片用 placement 接口手动安放。

完整字段、状态码和响应示例以 [OpenAPI](doc/openapi.yaml) 为准；数据字段与约束见 [数据库说明](doc/database.md)。

## 5. Nacos 与检查

参考 HealthServer 使用 Spring Cloud Alibaba Config starter；本项目只保留配置下载，使用 optional:nacos 导入，不启用服务发现或动态刷新。具体地址、命名空间、分组和认证字段以 .env.example 为准。

默认不需要 Nacos。启用后配置缺失／无法连接时回退本地配置；回退后的本地必填配置仍须完整。非法的已加载配置不能靠 optional 忽略。

```sh
./gradlew test
./gradlew build
java -jar build/libs/world-0.0.1-SNAPSHOT.jar
```

最终 jar 文件名以 build/libs 实际产物为准。运行 jar 的工作目录也应为本目录，以便 .env、SQLite 和密钥相对路径保持一致。

测试使用临时 SQLite、测试密钥和本地 HTTP 存储模拟；不读取真实 RustFS 密钥。源码入口见 [AGENTS](AGENTS.md) 和 [模块总览](doc/README.md)。

## 在线记忆与成员

V2 和 V3 Flyway 迁移增加邮箱、成员、章节、时刻、贡献、发现反馈和请求幂等记录，见[数据库说明](doc/database.md)。新账号通过 /api/v1/auth/register 建立，用户名、邮箱唯一。客户端对原密码 UTF-8 字节做 SHA-256，服务端对摘要做 BCrypt。摘要仍可重放，生产必须使用 HTTPS。旧演示账号只在配置的旧密码匹配时升级。

事件创建者可按用户名添加已注册成员；成员可贡献，只有实际作者可更新或删除自己的内容。public 当前仍仅对事件成员可见。示例篇章只读，复制后可编辑。素材引用必须指向已确认且有权限的对象；导出 JSON 不含照片字节或签名 URL。

真实浏览器上传需要 RustFS 桶 CORS 允许前端来源以及 PUT、GET、HEAD；本轮未改变桶配置。见[验证记录](doc/verification.md)。
