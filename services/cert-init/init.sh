#!/bin/sh
# ============================================================
#  证书保障脚本（一次性容器）
#
#  目标：无论哪种模式，都保证 nginx 启动时 /certs/active/ 下的证书
#        确实存在，从而让 nginx 永远不会因为"等不到证书"而卡住。
#
#  目录约定（/certs 是挂载进来的共享卷）：
#    live/<CERT_NAME>/   只有 certbot 会写，本脚本绝不写入
#                        —— certbot 若发现该目录已被非它自己创建，
#                           会永久拒绝为该 cert-name 签发且无法覆盖
#    selfsigned/         本脚本生成的自签名证书，certbot 不扫描此目录
#    active/             当前生效证书的符号链接，nginx 只读这里
#
#  仅在证书准备成功后返回 0；失败则阻止 nginx 被创建
#  （nginx 依赖 cert-init 的 service_completed_successfully 条件）。
# ============================================================

set -eu

CERTS_DIR="${CERTS_DIR:-/certs}"
LIVE_DIR="$CERTS_DIR/live"
SELF_DIR="$CERTS_DIR/selfsigned"
ACTIVE_DIR="$CERTS_DIR/active"

HAS_DOMAIN="${HAS_DOMAIN:-true}"
DOMAIN="${DOMAIN:-}"
SERVER_NAME="${SERVER_NAME:-_}"
CERT_WAIT_TIMEOUT="${CERT_WAIT_TIMEOUT:-300}"

# 证书目录名：显式指定优先，否则取 DOMAIN 的第一项并去掉通配符前缀
# 例如 DOMAIN="*.lovedage.com.cn" -> CERT_NAME="lovedage.com.cn"
if [ -z "${CERT_NAME:-}" ]; then
    _first="${DOMAIN%% *}"
    CERT_NAME="${_first#\*.}"
fi
CERT_NAME="${CERT_NAME:-localhost}"

LIVE_CERT_DIR="$LIVE_DIR/$CERT_NAME"


log() { echo "[cert-init] $*"; }

# ------------------------------------------------------------
# 是否已有 certbot 签发的真证书
# 判据用 renewal/<name>.conf：这是 certbot 自己管理的权威标记，
# 比只看文件存在更可靠（避免误认残留文件为有效证书）
# ------------------------------------------------------------
real_cert_ready() {
    [ -f "$CERTS_DIR/renewal/$CERT_NAME.conf" ] &&
        [ -r "$LIVE_CERT_DIR/fullchain.pem" ] && [ -r "$LIVE_CERT_DIR/privkey.pem" ]
}

# ------------------------------------------------------------
# 把 active/ 指向指定目录
# 必须用相对符号链接：cert-init 与 nginx 两个容器的挂载点不同
#（分别是 /certs 和 /etc/nginx/certs），绝对路径会在 nginx 侧断链。
# ------------------------------------------------------------
link_active() {
    _target="$1"    # 相对 CERTS_DIR 的路径，如 "live/foo" 或 "selfsigned"
    mkdir -p "$ACTIVE_DIR"
    ln -sfn "../$_target/fullchain.pem" "$ACTIVE_DIR/fullchain.pem"
    ln -sfn "../$_target/privkey.pem" "$ACTIVE_DIR/privkey.pem"
    log "active/ 已指向 $_target"
}

# ------------------------------------------------------------
# 生成自签名证书（幂等：已存在则复用）
# 必须带 SAN，否则现代浏览器直接拒绝连接而不是给出"继续访问"的选项
# ------------------------------------------------------------
generate_selfsigned() {
    if [ -f "$SELF_DIR/fullchain.pem" ] && [ -f "$SELF_DIR/privkey.pem" ]; then
        log "自签名证书已存在，复用"
        return 0
    fi

    case "$SERVER_NAME" in
        ""|"_")
            _cn="localhost"
            _san="DNS:localhost,IP:127.0.0.1"
            ;;
        *[!0-9.]*)
            # 含非数字/点 => 当作域名
            _cn="$SERVER_NAME"
            _san="DNS:$SERVER_NAME,DNS:localhost,IP:127.0.0.1"
            ;;
        *)
            # 纯数字与点 => 当作 IP
            _cn="$SERVER_NAME"
            _san="IP:$SERVER_NAME,DNS:localhost,IP:127.0.0.1"
            ;;
    esac

    log "生成自签名证书（CN=$_cn）"
    mkdir -p "$SELF_DIR"
    if ! openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
            -keyout "$SELF_DIR/privkey.pem" \
            -out "$SELF_DIR/fullchain.pem" \
            -subj "/CN=$_cn" \
            -addext "subjectAltName=$_san" >/dev/null 2>&1; then
        log "错误：自签名证书生成失败"
        return 1
    fi
    chmod 600 "$SELF_DIR/privkey.pem"
    log "自签名证书已生成（有效期 10 年）"
}

# ------------------------------------------------------------
# 有域名模式：轮询等待 certbot 签发
# ------------------------------------------------------------
wait_for_real_cert() {
    _interval=5
    _waited=0
    log "等待 certbot 签发证书（上限 ${CERT_WAIT_TIMEOUT}s），可用 'docker compose logs -f cert-init' 观察进度"
    while [ "$_waited" -lt "$CERT_WAIT_TIMEOUT" ]; do
        if real_cert_ready; then
            log "检测到 certbot 签发的证书（已等待 ${_waited}s）"
            return 0
        fi
        sleep "$_interval"
        _waited=$((_waited + _interval))
        log "  ...已等待 ${_waited}s / ${CERT_WAIT_TIMEOUT}s"
    done
    return 1
}

# ============================================================
main() {
    log "===== 开始 ====="
    log "HAS_DOMAIN=$HAS_DOMAIN  CERT_NAME=$CERT_NAME  SERVER_NAME=$SERVER_NAME"

    mkdir -p "$CERTS_DIR"
    [ -d "$LIVE_DIR" ] || log "提示：live/ 目录尚不存在（certbot 首次签发时才会创建）"

    # 快速路径：已有真证书，直接启用（二次 up -d 时亚秒级完成）
    if [ "$HAS_DOMAIN" != "false" ] && real_cert_ready; then
        log "已存在 certbot 签发的有效证书"
        link_active "live/$CERT_NAME"
        log "===== 完成 ====="
        exit 0
    fi

    # 无域名模式：直接自签名，不做任何等待
    if [ "$HAS_DOMAIN" = "false" ]; then
        log "无域名模式（HAS_DOMAIN=false），使用自签名证书"
        generate_selfsigned || exit 1
        link_active "selfsigned"
        log "===== 完成 ====="
        exit 0
    fi

    # 有域名模式：等 certbot 签发，超时则降级自签名保证 nginx 能起来
    if wait_for_real_cert; then
        link_active "live/$CERT_NAME"
    else
        log "############################################################"
        log "# 等待超时：未能取得 certbot 签发的证书，已降级为自签名证书"
        log "# nginx 会照常启动。请检查 letsencrypt 容器日志排查原因："
        log "#   docker compose logs letsencrypt"
        log "# 常见原因：ALIYUN_ACCESS_KEY_ID/SECRET 未填或权限不足、"
        log "#           域名未解析、USE_TEST_ENV 与证书用途不符"
        log "# 若稍后签发成功，执行 docker compose restart nginx 加载真证书"
        log "############################################################"
        generate_selfsigned || exit 1
        # 防止生成自签名期间 certbot 恰好完成签发后被覆盖。
        if real_cert_ready; then
            link_active "live/$CERT_NAME"
        else
            link_active "selfsigned"
        fi
    fi

    log "===== 完成 ====="
    exit 0
}

main
