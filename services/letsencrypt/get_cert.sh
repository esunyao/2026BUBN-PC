#!/bin/bash

LOG_FILE="/var/log/certbot-renew.log"

# 判断日志文件是否存在，不存在则创建
if [ ! -f "$LOG_FILE" ]; then
    touch "$LOG_FILE"
fi

# 证书目录名：显式指定优先，否则取 DOMAIN 的第一项并去掉通配符前缀
#（如 DOMAIN="*.lovedage.com.cn" -> CERT_NAME="lovedage.com.cn"）
# 注意：此处推导逻辑必须与 cert-init/init.sh 保持一致，两处同源。
if [ -z "${CERT_NAME:-}" ]; then
    _first="${DOMAIN%% *}"
    CERT_NAME="${_first#\*.}"
fi
CERT_NAME="${CERT_NAME:-localhost}"

if [ "$USE_TEST_ENV" = "true" ]; then
    CERTBOT_FLAGS="--test-cert"
else
    CERTBOT_FLAGS=""
fi

# 仅在配置了 WEBHOOK_URL 时才挂 deploy-hook。
# webhook.sh 在该变量为空时会 exit 1，而 certbot 会把这个失败的 hook
# 固化进 renewal/<name>.conf，导致之后每次自动续订都重演报错。
DEPLOY_HOOK_ARGS=""
if [ -n "${WEBHOOK_URL:-}" ]; then
    DEPLOY_HOOK_ARGS="--deploy-hook /usr/local/bin/webhook.sh"
fi

# 申请或续订证书的函数
renew_cert() {
    echo "检查是否存在证书目录"
    if [ ! -d "/etc/letsencrypt/live" ]; then
        echo "未找到现有证书目录，请求新的证书..." >> "$LOG_FILE"
        # 构建多域名参数
        domain_args=""
        for d in "${DOMAIN[@]}"; do
            domain_args="$domain_args -d $d"
        done
        certbot certonly \
            --cert-name "$CERT_NAME" \
            --non-interactive \
            --manual \
            --preferred-challenges dns \
            --manual-auth-hook "alidns" \
            --manual-cleanup-hook "alidns clean" \
            --email "$EMAIL" \
            --agree-tos \
            $CERTBOT_FLAGS \
            $domain_args \
            $DEPLOY_HOOK_ARGS
    else
        echo "找到现有证书目录，正在续订..." >> "$LOG_FILE"
        # renew 时会自动沿用之前证书的域名配置，无需再指定 -d
        certbot renew \
            --cert-name "$CERT_NAME" \
            --non-interactive \
            --manual \
            --preferred-challenges dns \
            --manual-auth-hook "alidns" \
            --manual-cleanup-hook "alidns clean" \
            --email "$EMAIL" \
            --agree-tos \
            $CERTBOT_FLAGS \
            $DEPLOY_HOOK_ARGS
    fi
}


if [ "$1" = "renew" ]; then
    echo "执行 renew_cert 函数..." >> $LOG_FILE
    renew_cert >> $LOG_FILE 2>&1
else

    # 检查并申请证书
    if [ ! -d "/etc/letsencrypt/live" ]; then
            renew_cert >> $LOG_FILE 2>&1
    else
            echo "已存在证书目录，跳过 renew_cert." >> $LOG_FILE
    fi
    
fi