#!/bin/bash
# 离线回归：不启动容器、不访问 DNS、不读取实际 .env。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"
export PATH="$TMP/bin:$PATH" MSYS_NO_PATHCONV=1
export DOMAIN='*.example.com example.com' EMAIL='test@example.com' CERT_NAME=example.com
export CERTS_DIR="$TMP/certs" LOG_FILE="$TMP/certbot.log" ARGS_FILE="$TMP/args"
export SERVER_NAME=192.0.2.10 CERT_WAIT_TIMEOUT=0

# 模拟外部程序，仅在临时目录写入测试证书。
cat > "$TMP/bin/openssl" <<'MOCK'
#!/bin/bash
[ "${FAIL_OPENSSL:-false}" != true ] || exit 1
while [ "$#" -gt 0 ]; do
    case "$1" in
        -out|-keyout) printf 'selfsigned\n' > "$2"; shift ;;
    esac
    shift
done
MOCK
cat > "$TMP/bin/certbot" <<'MOCK'
#!/bin/bash
printf '%s\n' "$@" > "$ARGS_FILE"
[ "${FAIL_CERTBOT:-false}" != true ] || exit 1
mkdir -p "$CERTS_DIR/live/$CERT_NAME" "$CERTS_DIR/renewal"
printf 'real\n' > "$CERTS_DIR/live/$CERT_NAME/fullchain.pem"
printf 'real-key\n' > "$CERTS_DIR/live/$CERT_NAME/privkey.pem"
touch "$CERTS_DIR/renewal/$CERT_NAME.conf"
MOCK
chmod +x "$TMP/bin/openssl" "$TMP/bin/certbot"

bash -n "$ROOT/letsencrypt/get_cert.sh"
sh -n "$ROOT/cert-init/init.sh"

HAS_DOMAIN=true sh "$ROOT/cert-init/init.sh" > "$TMP/init.log"
[ "$(cat "$CERTS_DIR/active/fullchain.pem")" = selfsigned ]
printf 'PASS: timeout fallback\n'

# 已存在 live/（含其他名称）时也必须能签发当前证书。
mkdir -p "$CERTS_DIR/live/other"
bash "$ROOT/letsencrypt/get_cert.sh"
mapfile -t args < "$ARGS_FILE"
[ "${args[0]}" = certonly ]
count=0
for ((i=0; i<${#args[@]}; i++)); do
    if [ "${args[i]}" = -d ]; then
        if [ "$count" -eq 0 ]; then
            [ "${args[i+1]}" = '*.example.com' ]
        else
            [ "${args[i+1]}" = example.com ]
        fi
        count=$((count+1))
    fi
done
[ "$count" -eq 2 ]
[ "$(cat "$CERTS_DIR/active/fullchain.pem")" = real ]
printf 'PASS: multi-domain issuance and late promotion\n'

bash "$ROOT/letsencrypt/get_cert.sh" renew
[ "$(head -n 1 "$ARGS_FILE")" = renew ]
printf 'PASS: existing certificate renewal\n'

HAS_DOMAIN=false sh "$ROOT/cert-init/init.sh" > "$TMP/init.log"
[ "$(cat "$CERTS_DIR/active/fullchain.pem")" = selfsigned ]
printf 'PASS: no-domain mode ignores existing real certificate\n'

export CERTS_DIR="$TMP/failed-certs" FAIL_OPENSSL=true
if HAS_DOMAIN=false sh "$ROOT/cert-init/init.sh" > "$TMP/init.log"; then
    printf 'FAIL: openssl failure was swallowed\n' >&2
    exit 1
fi
[ ! -e "$CERTS_DIR/active/fullchain.pem" ]
printf 'PASS: certificate generation failure blocks startup\n'

export FAIL_CERTBOT=true
if bash "$ROOT/letsencrypt/get_cert.sh"; then
    printf 'FAIL: certbot failure was swallowed\n' >&2
    exit 1
fi
printf 'PASS: issuance failure propagated\n'
