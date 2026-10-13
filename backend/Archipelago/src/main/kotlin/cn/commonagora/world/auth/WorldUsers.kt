package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import org.springframework.boot.ApplicationRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

class WorldUser(val id: String, private val login: String, private val hash: String) : UserDetails {
    override fun getUsername() = login
    override fun getPassword() = hash
    override fun getAuthorities(): Collection<GrantedAuthority> = emptyList()
}

@Service
class WorldUsers(private val jdbc: JdbcTemplate) : UserDetailsService {
    override fun loadUserByUsername(username: String): WorldUser = jdbc.query(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        { rs, _ -> WorldUser(rs.getString("id"), rs.getString("username"), rs.getString("password_hash")) }, username
    ).firstOrNull() ?: throw UsernameNotFoundException("Unknown user")

    fun username(id: String): String? = jdbc.query("SELECT username FROM users WHERE id = ?", { rs, _ -> rs.getString(1) }, id).firstOrNull()
}

@Configuration
class DemoUserConfiguration {
    @Bean fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun seedDemoUser(jdbc: JdbcTemplate, properties: AuthProperties, encoder: PasswordEncoder) = ApplicationRunner {
        if (jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE username = ?", Int::class.java, properties.demoUsername) == 0) {
            require(properties.demoPassword.isNotBlank()) { "WORLD_DEMO_PASSWORD is required to initialize the demo user" }
            require(properties.demoPassword.toByteArray(Charsets.UTF_8).size <= 72) { "Demo password exceeds BCrypt's 72-byte limit" }
            jdbc.update("INSERT OR IGNORE INTO users(id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
                UUID.randomUUID().toString(), properties.demoUsername, encoder.encode(properties.demoPassword), System.currentTimeMillis())
        }
    }
}

data class MeResponse(val id: String, val username: String)

@RestController
class MeController(private val users: WorldUsers) {
    @GetMapping("/api/v1/me")
    fun me(@AuthenticationPrincipal jwt: Jwt): MeResponse {
        val id = requireNotNull(jwt.subject)
        return MeResponse(id, users.username(id) ?: throw UsernameNotFoundException("Unknown user"))
    }
}
