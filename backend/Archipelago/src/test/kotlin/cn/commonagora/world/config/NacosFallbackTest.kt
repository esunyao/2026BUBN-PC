package cn.commonagora.world.config

import cn.commonagora.world.ArchipelagoApplication
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertTimeout
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.SpringApplication
import java.nio.file.Path
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class NacosFallbackTest {
    @TempDir lateinit var directory: Path

    @Test fun `enabled unreachable optional Nacos falls back to local configuration within bounded startup`() {
        // Port 1 on loopback fails immediately; no deployed Nacos or external network is contacted.
        assertTimeout(Duration.ofSeconds(45)) {
            SpringApplication(ArchipelagoApplication::class.java).run(
                "--spring.cloud.nacos.config.enabled=true",
                "--spring.cloud.nacos.config.server-addr=127.0.0.1:1",
                "--spring.cloud.nacos.config.timeout=500",
                "--spring.cloud.nacos.config.namespace=unreachable-test",
                "--spring.cloud.nacos.config.group=LOCAL_FALLBACK_TEST",
                "--world.database.path=${directory.resolve("test.db")}",
                "--world.auth.key-path=${directory.resolve("key.json")}",
                "--world.auth.demo-password=test-only-password",
                "--springdotenv.enabled=false", "--server.port=0"
            ).use { context ->
                assertTrue(context.isActive)
                assertFalse(context.getBean(StorageProperties::class.java).enabled)
                assertEquals("LOCAL_FALLBACK_TEST", context.environment.getProperty("spring.cloud.nacos.config.group"))
                assertEquals("500", context.environment.getProperty("spring.cloud.nacos.config.timeout"))
                assertFalse(context.environment.getProperty("spring.cloud.compatibility-verifier.enabled") == "false")
            }
        }
    }
}
