# services —— Docker 部署目录

本目录是 Docker 部署的根目录。所有相对路径都基于它，请在**本目录内**执行 compose 命令。

```
cd services
docker compose up -d
```

> **必须在代码所在的机器上执行。** compose 里的数据卷、nginx 配置、证书目录都是相对路径 bind mount，
> 这些路径是在 **Docker 守护进程所在的主机**上解析的。
> 如果你的 docker CLI 连的是远程 daemon（`docker context ls` 查看），
> 而代码在本机，挂载会指向远端不存在的目录。

## 目录结构

```
services/
├── docker-compose.yaml                    编排定义
├── .env                                   实际配置（不入库，含密钥）
├── .env.example                           配置模板
├── backend/Dockerfile                     后端镜像：多阶段构建，自动执行
├── cert-init/                             证书保障：保证 nginx 一定有证书可加载
├── nginx/conf.d/default.conf.template     站点配置（envsubst 模板）
├── letsencrypt/                           阿里云 DNS 证书申请与续订
└── AppData/                               运行时数据（不入库，自动创建）
    ├── rustfs_data/                       对象存储数据
    ├── backend_data/                      SQLite 数据库 + RSA 私钥
    └── certs/                             证书树（见下）
```

## 快速开始

```bash
cd services
cp .env.example .env
# 编辑 .env：至少填好 RUSTFS_ACCESS_KEY/SECRET_KEY 和 WORLD_DEMO_PASSWORD
docker compose up -d
```

首次执行会自动构建后端镜像（Gradle 需下载依赖，**视网络约 5～15 分钟**）。
用 `docker compose logs -f backend` 观察构建后的启动情况。

启动完成后：

| 入口 | 地址 |
| --- | --- |
| 后端 API / OIDC | `https://<域名>/` 或 `https://<IP>/`（经 nginx 443） |
| 后端直连（调试） | `http://127.0.0.1:8080/.well-known/openid-configuration`（仅宿主机） |
| 对象存储（浏览器用） | `https://<域名>:8444` |

## 两种模式

模式由 `.env` 里的 `HAS_DOMAIN` 决定，切换后执行 `docker compose up -d` 生效。

### `HAS_DOMAIN=true`（有域名）

`letsencrypt` 用阿里云 DNS-01 申请真证书，`cert-init` 等它签发完成后把证书链接到 nginx 读取的位置。

首次执行 `up -d` 会**阻塞至多 `CERT_WAIT_TIMEOUT` 秒**（默认 300）——这段时间 nginx 还没创建，属正常现象。
用 `docker compose logs -f cert-init` 可以看到等待进度。

需要先准备：
- `DOMAIN`（通配符需 DNS-01，本方案已用）、`EMAIL`
- `ALIYUN_ACCESS_KEY_ID` / `ALIYUN_ACCESS_KEY_SECRET`（RAM 子账号，授予 `AliyunDNSFullAccess`）
- 域名的 A 记录指向本机
- 证书要覆盖对象存储地址的主机名（如 `api.` 子域）——同时申请根域名和通配符域名（如 `DOMAIN="*.example.com example.com"`），
  否则浏览器访问 `https://api.<域名>:8444` 会报证书不匹配

### `HAS_DOMAIN=false`（无域名）

`letsencrypt` 打印提示后正常退出（`Exited (0)`，不会重启刷屏），
`cert-init` 直接生成自签名证书，nginx 照常以 HTTPS 启动。

把 `SERVER_NAME` 设为服务器实际 IP、`PUBLIC_ORIGIN` 设为 `https://<服务器IP>`，
`WORLD_STORAGE_PUBLIC_ENDPOINT` 设为 `https://<服务器IP>:8444`。两种模式均使用 HTTPS。
自签名证书需要在客户端安装并信任（文件位于 `AppData/certs/selfsigned/fullchain.pem`），
否则浏览器的 OIDC 请求和对象存储请求可能失败；仅跳过主站警告不保证跨端口请求可用。
修改 IP 后需重新生成对应 SAN 的自签名证书，不能继续复用旧 IP 的证书。

## 证书目录的约定

```
AppData/certs/
├── live/<CERT_NAME>/     certbot 签发，只有它能写这里
├── archive/  renewal/    certbot 自管
├── selfsigned/           cert-init 生成的自签名证书
└── active/               当前生效证书的符号链接，nginx 只读这里
```

nginx 配置里固定引用 `active/`，两种模式零分支。

**不要手工把证书放进 `live/`**：certbot 一旦发现有非它自己创建的 `live/<name>/` 目录，
会永久拒绝为该名称签发证书，且没有覆盖参数——只能人工删掉目录才能恢复。

## 运维须知

- **自定义 HTTPS 端口**：`PUBLIC_ORIGIN` 必须包含 `HTTPS_PORT`（非 443 时）；存储地址同样必须匹配 `STORAGE_PORT`。
- **调试端口仅绑定回环地址**：远程调试请使用 SSH 隧道，不要直接开放后端端口。nginx 会覆盖来源头，后端只信任这层代理。
- **改 `.env` 后必须 `docker compose up -d`**。`docker compose restart` 只是重启进程，
  **永远不会**重新读取环境变量，这是最常见的"改了不生效"原因。
- **certbot 续订后 nginx 不会自动加载新证书**。证书 90 天有效、到期前 30 天自动续订，
  签发/续订成功后脚本会将 `active/` 指向真证书（含首次等待超时后才签发的情况），随后需执行 `docker compose restart nginx`。
  （容器内 crond 每天 02:00（`TZ` 指定时区）执行续订检查）
- **`WORLD_STORAGE_PUBLIC_ENDPOINT` 必须是浏览器可达的地址**，
  它会被写进预签名 URL。填成内网地址（如 `http://rustfs:9000`）会导致前端图片全部加载失败。
- **首次部署必须设置 `WORLD_DEMO_PASSWORD`**，留空会让后端启动失败并报
  `WORLD_DEMO_PASSWORD is required to initialize the demo user`。
  账号一旦创建，之后修改该变量不会重设密码。
- **`AppData/` 的属主**：RustFS 以 uid 10001 运行，`init-perms` 服务会自动修正
  `rustfs_data` 的属主。Linux 上生效；Windows 的 Docker Desktop 走 drvfs，chown 会被忽略
  （不影响使用）。迁移环境时若 rustfs 报权限错误，检查这个目录的属主。
- **`RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` 同时供 rustfs 和后端使用**，
  只需在这一处维护。不要使用任何默认弱口令。

## 排错

| 现象 | 检查点 |
| --- | --- |
| nginx 起不来 | `docker compose logs cert-init` —— 证书是否生成成功 |
| 有域名但拿到的是自签名证书 | `docker compose logs letsencrypt` —— certbot 是否认证失败（AK 权限、DNS 解析），确认后 `docker compose restart nginx` |
| 后端 502 | Spring 启动需 20～60 秒，属正常；超时则看 `docker compose logs backend` |
| 改了 .env 没生效 | 用 `up -d` 而不是 `restart` |
| 前端页面打不开 | 本仓库暂不由 nginx 托管前端，根路径返回 404。需要时见 `nginx/conf.d/default.conf.template` 中注释掉的静态块 |
