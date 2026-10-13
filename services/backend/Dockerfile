# ============================================================
#  Archipelago 后端镜像（多阶段构建）
#
#  build context : ../backend/Archipelago
#  dockerfile    : services/backend/Dockerfile
#
#  由 services/docker-compose.yaml 的 backend 服务自动构建，
#  无需手动 docker build。
# ============================================================


# ------------------------------------------------------------
# 阶段 1：构建
# ------------------------------------------------------------
FROM eclipse-temurin:21-jdk AS build

# Gradle Wrapper 首次运行需要下载并解压 Gradle 发行包（约 150MB），
# temurin 基础镜像不保证带 unzip
RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip wget \
 && rm -rf /var/lib/apt/lists/*

# 通过 init.gradle 注入阿里云 Maven 镜像。
# 仓库里的 build.gradle 保持不动——这里改的是容器内的全局构建环境。
# 若构建机器能直连 Maven Central，可整段删除。
RUN mkdir -p /root/.gradle && printf '%s\n' \
    'allprojects {' \
    '    repositories {' \
    '        maven { url "https://maven.aliyun.com/repository/public" }' \
    '    }' \
    '}' \
    'settingsEvaluated { settings ->' \
    '    settings.pluginManagement {' \
    '        repositories {' \
    '            maven { url "https://maven.aliyun.com/repository/gradle-plugin" }' \
    '            gradlePluginPortal()' \
    '        }' \
    '    }' \
    '}' \
    > /root/.gradle/init.gradle

WORKDIR /src

# 先只拷构建脚本并预热依赖缓存。
# 这样后续改 src/ 下的代码时，这一层仍在缓存中，不会重新下载依赖。
# `|| true` 是容错：预热失败不应中断构建，真正的错误会在下一步暴露。
COPY gradle/ gradle/
COPY gradlew settings.gradle build.gradle ./
RUN chmod +x gradlew && ./gradlew --no-daemon dependencies || true

COPY src/ src/
# 不需要 -x test：test 不在 bootJar 的依赖链上（它挂在 check -> build 下）
RUN ./gradlew --no-daemon bootJar


# ------------------------------------------------------------
# 阶段 2：运行
# ------------------------------------------------------------
FROM eclipse-temurin:21-jre

WORKDIR /app

# 按容器内存上限的比例设置 JVM 堆，避免小内存机器上默认堆过大被 OOM kill
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"

# build/libs 下同时存在两个 jar：
#   world-0.0.1-SNAPSHOT.jar        可执行 fat jar（我们要的）
#   world-0.0.1-SNAPSHOT-plain.jar  未重打包的普通 jar
# 用 *.jar 会匹配到两个导致 COPY 失败，必须用 *-SNAPSHOT.jar 精确匹配。
# 升级 version 后此通配仍有效（只要还是 -SNAPSHOT 后缀）。
COPY --from=build /src/build/libs/*-SNAPSHOT.jar /app/app.jar

# 数据目录：SQLite 数据库与 RSA 私钥由 compose 挂载持久化到宿主机
VOLUME ["/app/data"]

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
