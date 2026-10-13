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
    @Test fun `legacy demo upgrade requires matching configured raw credential`() {
        (DatabaseConfiguration().dataSource(directory.resolve("legacy.db").toString()) as com.zaxxer.hikari.HikariDataSource).use { source ->
            val jdbc = JdbcTemplate(source)
            jdbc.execute("CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE, password_hash TEXT NOT NULL, credential_scheme TEXT NOT NULL DEFAULT 'raw-bcrypt', created_at INTEGER NOT NULL)")
            val originalHash = org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("legacy-secret")
            jdbc.update("INSERT INTO users(id,username,password_hash,created_at) VALUES ('legacy-id','demo',?,0)", originalHash)
            val config = DemoUserConfiguration()
            val encoder = config.passwordEncoder()
            val args = DefaultApplicationArguments()
            assertFails { config.seedDemoUser(jdbc, AuthProperties(), encoder).run(args) }
            assertFails { config.seedDemoUser(jdbc, AuthProperties(demoPassword = "wrong-secret"), encoder).run(args) }
            assertEquals(originalHash, WorldUsers(jdbc).loadUserByUsername("demo").password)
            assertFalse(WorldUsers(jdbc).loadUserByUsername("demo").isEnabled())
            config.seedDemoUser(jdbc, AuthProperties(demoPassword = "legacy-secret"), encoder).run(args)
            val upgraded = WorldUsers(jdbc).loadUserByUsername("demo")
            assertEquals("legacy-id", upgraded.id)
            assertTrue(upgraded.isEnabled())
            assertTrue(encoder.matches(PasswordDigests.sha256("legacy-secret"), upgraded.password))
            assertFalse(encoder.matches("legacy-secret", upgraded.password))
        }
    }
    @Test fun `demo seed stores BCrypt and restart preserves id and password`() {
        (DatabaseConfiguration().dataSource(directory.resolve("users.db").toString()) as com.zaxxer.hikari.HikariDataSource).use { source ->
            val jdbc = JdbcTemplate(source)
            jdbc.execute("CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE, password_hash TEXT NOT NULL, credential_scheme TEXT NOT NULL DEFAULT 'raw-bcrypt', created_at INTEGER NOT NULL)")
            val config = DemoUserConfiguration()
            val encoder = config.passwordEncoder()
            val args = DefaultApplicationArguments()
            assertFails { config.seedDemoUser(jdbc, AuthProperties(), encoder).run(args) }
            config.seedDemoUser(jdbc, AuthProperties(demoPassword = "initial-test-password"), encoder).run(args)
            val first = WorldUsers(jdbc).loadUserByUsername("demo")
            assertTrue(encoder.matches(PasswordDigests.sha256("initial-test-password"), first.password))
            assertEquals(PasswordDigests.SCHEME, first.credentialScheme)
            config.seedDemoUser(jdbc, AuthProperties(demoPassword = "changed-test-password"), encoder).run(args)
            val after = WorldUsers(jdbc).loadUserByUsername("demo")
            assertEquals(first.id, after.id)
            assertEquals(first.password, after.password)
            assertFalse(encoder.matches(PasswordDigests.sha256("changed-test-password"), after.password))
        }
    }
}
