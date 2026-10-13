package cn.commonagora.world.config

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.nio.file.Files
import java.time.Duration
import me.paulschwarz.springdotenv.springboot.Boot4DotenvEnvironmentPostProcessor
import org.springframework.boot.SpringApplication
import org.springframework.core.env.StandardEnvironment
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.SystemEnvironmentPropertySource
import kotlin.test.*

class ConfigurationTest {
    @TempDir lateinit var directory: Path
    @Test fun `disabled storage accepts missing credentials but enabled storage fails`() {
        assertFalse(StorageProperties().enabled)
        assertFailsWith<IllegalArgumentException> { StorageProperties(enabled = true) }
    }
    @Test fun `SQLite enables WAL foreign keys and busy timeout on the pooled connection`() {
        val source = DatabaseConfiguration().dataSource(directory.resolve("test.db").toString()) as com.zaxxer.hikari.HikariDataSource
        source.use { pool -> pool.connection.use { connection ->
            connection.createStatement().use { statement ->
                for ((pragma, expected) in listOf("foreign_keys" to "1", "journal_mode" to "wal", "busy_timeout" to "5000")) {
                    statement.executeQuery("PRAGMA $pragma").use { result ->
                        assertTrue(result.next())
                        assertEquals(expected, result.getString(1))
                    }
                }
            }
            assertEquals(1, pool.maximumPoolSize)
        } }
    }

    @Test fun `storage validation rejects unsafe endpoints and unrepresentable signing lifetimes without leaking values`() {
        fun valid() = StorageProperties(true, "http://localhost:9000", "https://photos.example", "test-key", "test-secret", "photos")
        valid().validate()
        for (endpoint in listOf("http://user:test-secret@localhost:9000", "http://bad host", "https://photos.example?secret=test-secret", "file:///private")) {
            val failure = assertFailsWith<IllegalArgumentException> { valid().copy(endpoint = endpoint) }
            assertFalse(failure.message.orEmpty().contains("test-secret"))
            assertFalse(failure.message.orEmpty().contains(endpoint))
        }
        assertFailsWith<IllegalArgumentException> { valid().copy(maxFileBytes = 0) }
        for (ttl in listOf(Duration.ZERO, Duration.ofNanos(1), Duration.ofDays(8), Duration.ofSeconds(Long.MAX_VALUE))) {
            assertFailsWith<IllegalArgumentException> { valid().copy(uploadTtl = ttl) }
            assertFailsWith<IllegalArgumentException> { valid().copy(downloadTtl = ttl) }
        }
    }

    @Test fun `official dotenv post processor loads secret and preserves system environment priority`() {
        Files.writeString(directory.resolve(".env"), "WORLD_DEMO_PASSWORD=file-only-test-value\nWORLD_STORAGE_SECRET_KEY=local-test-value\n")
        val environment = StandardEnvironment()
        environment.propertySources.replace(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
            SystemEnvironmentPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
                mapOf<String, Any>("WORLD_STORAGE_SECRET_KEY" to "deployment-test-value")))
        environment.propertySources.addFirst(MapPropertySource("test-dotenv-settings", mapOf(
            "springdotenv.directory" to directory.toString(), "springdotenv.ignoreIfMissing" to false)))
        Boot4DotenvEnvironmentPostProcessor().postProcessEnvironment(environment, SpringApplication())
        assertEquals("file-only-test-value", environment.getProperty("WORLD_DEMO_PASSWORD"))
        assertEquals("deployment-test-value", environment.getProperty("WORLD_STORAGE_SECRET_KEY"))
    }
}
