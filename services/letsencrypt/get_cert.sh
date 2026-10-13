#!/bin/bash

set -euo pipefail

LOG_FILE="${LOG_FILE:-/var/log/certbot-renew.log}"
CERTS_DIR="${CERTS_DIR:-/etc/letsencrypt}"
touch "$LOG_FILE"

# DOMAIN 是空格分隔的环境变量，不是 Bash 数组；禁止通配符展开。
read -r -a domains <<< "${DOMAIN:-}"
if [ "${#domains[@]}" -eq 0 ]; then
    echo "DOMAIN 必须至少包含一个域名" >&2
    exit 1
fi
CERT_NAME="${CERT_NAME:-${domains[0]#\*.}}"

certbot_flags=()
if [ "${USE_TEST_ENV:-false}" = "true" ]; then
    certbot_flags+=(--test-cert)
fi
if [ -n "${WEBHOOK_URL:-}" ]; then
    certbot_flags+=(--deploy-hook /usr/local/bin/webhook.sh)
fi

renew_cert() {
    # 其他证书的 live/ 目录或失败残留不能代表当前名称已签发。
    if [ -f "$CERTS_DIR/renewal/$CERT_NAME.conf" ]; then
        echo "续订证书：$CERT_NAME"
        certbot renew --config-dir "$CERTS_DIR" \
            --cert-name "$CERT_NAME" --non-interactive "${certbot_flags[@]}"
    else
        echo "申请证书：$CERT_NAME"
        domain_args=()
        for domain in "${domains[@]}"; do
            domain_args+=(-d "$domain")
        done
        certbot certonly --config-dir "$CERTS_DIR" \
            --cert-name "$CERT_NAME" --non-interactive \
            --manual --preferred-challenges dns \
            --manual-auth-hook "alidns" --manual-cleanup-hook "alidns clean" \
            --email "${EMAIL:?EMAIL 必须设置}" --agree-tos \
            "${certbot_flags[@]}" "${domain_args[@]}"
    fi

    # 包括超时降级后才签发的情况；nginx 重启即可加载真证书。
    if [ -r "$CERTS_DIR/live/$CERT_NAME/fullchain.pem" ] && \
       [ -r "$CERTS_DIR/live/$CERT_NAME/privkey.pem" ]; then
        mkdir -p "$CERTS_DIR/active"
        ln -sfn "../live/$CERT_NAME/fullchain.pem" "$CERTS_DIR/active/fullchain.pem"
        ln -sfn "../live/$CERT_NAME/privkey.pem" "$CERTS_DIR/active/privkey.pem"
        echo "active/ 已指向 live/$CERT_NAME；请重启 nginx 加载证书"
    else
        echo "证书文件不完整：$CERT_NAME" >&2
        return 1
    fi
}

renew_cert >> "$LOG_FILE" 2>&1
