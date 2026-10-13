package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import cn.commonagora.world.shared.ApiException
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
import org.springframework.web.bind.annotation.*
import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.UncategorizedSQLException
import org.springframework.http.HttpStatus
import jakarta.validation.Valid
import jakarta.validation.constraints.Size
import jakarta.validation.constraints.Pattern
import java.util.UUID
import java.util.Locale
import java.security.MessageDigest

object PasswordDigests {
    const val SCHEME = "sha256-v1"
    fun sha256(raw: String): String = MessageDigest.getInstance("SHA-256")
        .digest(raw.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    fun isValid(digest: CharSequence?) = digest != null && Regex("[0-9a-f]{64}").matches(digest)
}

/** Browser/API input is always the SHA-256 digest, never a raw password. */
class DigestPasswordEncoder : PasswordEncoder {
    private val bcrypt = BCryptPasswordEncoder()
    override fun encode(rawPassword: CharSequence?): String {
        // DaoAuthenticationProvider encodes a non-digest dummy value for unknown-user timing protection.
        // Registration and demo seeding validate/derive digests before calling this method.
        return requireNotNull(bcrypt.encode(rawPassword))
    }
    override fun matches(rawPassword: CharSequence?, encodedPassword: String?): Boolean =
        PasswordDigests.isValid(rawPassword) && encodedPassword != null && bcrypt.matches(rawPassword, encodedPassword)
}

class WorldUser(val id: String, private val login: String, private val hash: String,
                val email: String? = null, val credentialScheme: String = PasswordDigests.SCHEME) : UserDetails {
    override fun getUsername() = login
    override fun getPassword() = hash
    override fun getAuthorities(): Collection<GrantedAuthority> = emptyList()
    override fun isEnabled() = credentialScheme == PasswordDigests.SCHEME
}

@Service
class WorldUsers(private val jdbc: JdbcTemplate) : UserDetailsService {
    override fun loadUserByUsername(username: String): WorldUser = jdbc.query(
        "SELECT id, username, password_hash, email, credential_scheme FROM users WHERE username = ?",
        { rs, _ -> WorldUser(rs.getString("id"), rs.getString("username"), rs.getString("password_hash"),
            rs.getString("email"), rs.getString("credential_scheme")) }, username
    ).firstOrNull() ?: throw UsernameNotFoundException("Unknown user")

    fun username(id: String): String? = jdbc.query("SELECT username FROM users WHERE id = ?", { rs, _ -> rs.getString(1) }, id).firstOrNull()
    fun me(id: String): MeResponse = jdbc.query("SELECT id, username, email FROM users WHERE id = ?",
        { rs, _ -> MeResponse(rs.getString("id"), rs.getString("username"), rs.getString("email")) }, id)
        .firstOrNull() ?: throw UsernameNotFoundException("Unknown user")
}

@Configuration
class DemoUserConfiguration {
    @Bean fun passwordEncoder(): PasswordEncoder = DigestPasswordEncoder()

    @Bean
    fun seedDemoUser(jdbc: JdbcTemplate, properties: AuthProperties, encoder: PasswordEncoder) = ApplicationRunner {
        val existing = jdbc.query("SELECT id, password_hash, credential_scheme FROM users WHERE username = ?",
            { rs, _ -> Triple(rs.getString("id"), rs.getString("password_hash"), rs.getString("credential_scheme")) }, properties.demoUsername).firstOrNull()
        if (existing == null) {
            require(properties.demoPassword.isNotBlank()) { "WORLD_DEMO_PASSWORD is required to initialize the demo user" }
            jdbc.update("INSERT INTO users(id, username, password_hash, credential_scheme, created_at) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID().toString(), properties.demoUsername, encoder.encode(PasswordDigests.sha256(properties.demoPassword)),
                PasswordDigests.SCHEME, System.currentTimeMillis())
        } else if (existing.third == "raw-bcrypt") {
            require(properties.demoPassword.isNotBlank() &&
                runCatching { BCryptPasswordEncoder().matches(properties.demoPassword, existing.second) }.getOrDefault(false)) {
                "Legacy demo credential upgrade requires WORLD_DEMO_PASSWORD matching the existing password; restore its original value and restart"
            }
            jdbc.update("UPDATE users SET password_hash = ?, credential_scheme = ? WHERE id = ? AND credential_scheme = 'raw-bcrypt'",
                encoder.encode(PasswordDigests.sha256(properties.demoPassword)), PasswordDigests.SCHEME, existing.first)
        }
    }
}

data class RegisterRequest(
    @field:Pattern(regexp = "[A-Za-z0-9_-]{3,32}") val username: String,
    @field:Size(min = 3, max = 254) val email: String,
    @field:Pattern(regexp = "[0-9a-f]{64}") val passwordDigest: String,
)
data class MeResponse(val id: String, val username: String, val email: String? = null)

@Service
class RegistrationService(private val jdbc: JdbcTemplate, private val encoder: PasswordEncoder) {
    fun register(request: RegisterRequest): MeResponse {
        val email = request.email.trim().lowercase(Locale.ROOT)
        if (!Regex("[A-Za-z0-9_-]{3,32}").matches(request.username) || !PasswordDigests.isValid(request.passwordDigest) ||
            email.length !in 3..254 || !Regex("[^\\s@]+@[^\\s@]+\\.[^\\s@]+").matches(email))
            throw ApiException(HttpStatus.BAD_REQUEST, "Invalid registration fields")
        val response = MeResponse(UUID.randomUUID().toString(), request.username, email)
        try {
            jdbc.update("INSERT INTO users(id, username, email, password_hash, credential_scheme, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                response.id, response.username, email, encoder.encode(request.passwordDigest), PasswordDigests.SCHEME, System.currentTimeMillis())
        } catch (_: DuplicateKeyException) {
            throw ApiException(HttpStatus.CONFLICT, "Username or email is already registered")
        } catch (failure: UncategorizedSQLException) {
            // SQLite's extended uniqueness code is not translated to DuplicateKeyException by JdbcTemplate.
            if (failure.sqlException?.message?.contains("UNIQUE constraint failed: users.") == true)
                throw ApiException(HttpStatus.CONFLICT, "Username or email is already registered")
            throw failure
        }
        return response
    }
}

@RestController
class RegistrationController(private val service: RegistrationService) {
    @PostMapping("/api/v1/auth/register") @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody request: RegisterRequest) = service.register(request)
}

@RestController
class MeController(private val users: WorldUsers) {
    @GetMapping("/api/v1/me")
    fun me(@AuthenticationPrincipal jwt: Jwt): MeResponse = users.me(requireNotNull(jwt.subject))
}
