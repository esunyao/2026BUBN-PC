package cn.commonagora.world.config

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Duration
import java.net.URI

@ConfigurationProperties("world.storage")
data class StorageProperties(
    val enabled: Boolean = false,
    val endpoint: String = "",
    val publicEndpoint: String = "",
    val accessKey: String = "",
    val secretKey: String = "",
    val bucket: String = "",
    val region: String = "us-east-1",
    val maxFileBytes: Long = 20971520,
    val uploadTtl: Duration = Duration.ofMinutes(5),
    val downloadTtl: Duration = Duration.ofMinutes(15),
) {
    init { validate() }

    fun validate() {
        if (enabled) {
            require(listOf(endpoint, publicEndpoint, accessKey, secretKey, bucket, region).all { it.isNotBlank() }) {
                "Enabled world.storage requires endpoints, credentials, bucket and region"
            }
            require(listOf(endpoint, publicEndpoint).all { value ->
                runCatching { URI(value) }.getOrNull()?.let { uri ->
                    uri.scheme in listOf("http", "https") && uri.host != null && uri.rawUserInfo == null &&
                        uri.rawQuery == null && uri.rawFragment == null && uri.port in -1..65535
                } == true
            }) { "Storage endpoints must be HTTP(S) URLs without credentials, queries or fragments" }
            require(maxFileBytes > 0) { "Storage maximum file size must be positive" }
            // SigV4 URLs may last at most seven days. Check before converting to milliseconds.
            require(listOf(uploadTtl, downloadTtl).all { it >= Duration.ofSeconds(1) && it <= Duration.ofDays(7) }) {
                "Storage URL TTL must be between one second and seven days"
            }
        }
    }
}

@ConfigurationProperties("world.auth")
data class AuthProperties(
    val issuer: String = "http://localhost:8080",
    val redirectUri: String = "http://localhost:5173/auth/callback",
    val postLogoutRedirectUri: String = "http://localhost:5173/",
    val allowedOrigin: String = "http://localhost:5173",
    val keyPath: String = "./data/signing-key.json",
    val demoUsername: String = "demo",
    val demoPassword: String = "",
)
