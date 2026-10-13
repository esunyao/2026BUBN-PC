#!/bin/bash

echo "启动入口脚本..."

# 无域名模式：没有域名可做 DNS-01 验证，certbot 必然失败。
# 这里直接正常退出（exit 0），配合 docker-compose.yaml 中的
# restart: on-failure，容器保持 Exited (0) 而不会陷入重启循环。
# 证书由 cert-init 用自签名方式保障，nginx 不受影响、照常启动。
if [ "${HAS_DOMAIN:-true}" = "false" ]; then
    echo "HAS_DOMAIN=false（无域名模式），跳过证书申请与续订。"
    echo "需要真证书时：在 .env 中设置 HAS_DOMAIN=true 并填好 DOMAIN、EMAIL、ALIYUN_ACCESS_KEY_* 后，执行 docker compose up -d"
    exit 0
fi

# 配置阿里云 CLI
aliyun configure set --access-key-id "$ALIYUN_ACCESS_KEY_ID" --access-key-secret "$ALIYUN_ACCESS_KEY_SECRET" --region "cn-hangzhou"

LOG_FILE="/var/log/certbot-renew.log"

# 判断日志文件是否存在，不存在则创建
if [ ! -f "$LOG_FILE" ]; then
    touch $LOG_FILE
fi

# 添加 CertBot 续订任务到 crontab
if ! crontab -l | grep -q "0 2 * * * /usr/local/bin/get_cert.sh renew >> $LOG_FILE 2>&1"; then
    echo "将 CertBot 续订任务添加到 crontab..." >> $LOG_FILE
    echo "0 2 * * * /usr/local/bin/get_cert.sh renew >> $LOG_FILE 2>&1" | crontab -
fi

/usr/local/bin/get_cert.sh >> $LOG_FILE 2>&1

# 启动 crond 服务并保持容器运行，同时输出日志
echo "启动 crond 服务..." >> $LOG_FILE
crond

# 实时输出日志
tail -f $LOG_FILE