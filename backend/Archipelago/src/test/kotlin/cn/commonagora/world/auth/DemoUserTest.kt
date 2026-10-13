package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import cn.commonagora.world.config.DatabaseConfiguration
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.boot.DefaultApplicationArguments
import org.springframework.jdbc.core.JdbcTemplate
import java.nio.file.Path
import kotlin.test.*

class DemoUserTest {
    @TempDir lateinit var directory: Path
    @Test fun `demo seed stores BCrypt and restart preserves id and password`() {
        (DatabaseConfiguration().dataSource(directory.resolve("users.db").toString()) as com.zaxxer.hikari.HikariDataSource).use { source ->
            val jdbc = JdbcTemplate(source)
            jdbc.execute("CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL)")
            val config = DemoUserConfiguration()
            val encoder = config.passwordEncoder()
            val args = DefaultApplicationArguments()
            assertFails { config.seedDemoUser(jdbc, AuthProperties(), encoder).run(args) }
            config.seedDemoUser(jdbc, AuthProperties(demoPassword = "initial-test-password"), encoder).run(args)
            val first = WorldUsers(jdbc).loadUserByUsername("demo")
            assertTrue(encoder.matches("initial-test-password", first.password))
            config.seedDemoUser(jdbc, AuthProperties(demoPassword = "changed-test-password"), encoder).run(args)
            val after = WorldUsers(jdbc).loadUserByUsername("demo")
            assertEquals(first.id, after.id)
            assertEquals(first.password, after.password)
            assertFalse(encoder.matches("changed-test-password", after.password))
        }
    }
}
