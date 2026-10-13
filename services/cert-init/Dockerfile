FROM alpine:3.24

# 换源（与 letsencrypt/Dockerfile 保持一致）
RUN sed -i 's#https\?://dl-cdn.alpinelinux.org/alpine#https://mirrors.aliyun.com/alpine#g' /etc/apk/repositories

# 只需要 openssl：证书的生成与检查都在 init.sh 里用 POSIX sh 完成
RUN apk add --no-cache openssl

COPY init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

ENTRYPOINT ["/usr/local/bin/init.sh"]
