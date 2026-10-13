package cn.commonagora.world.auth

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import tools.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.security.MessageDigest
import java.util.Base64
import java.net.URI
import java.net.URLDecoder
import org.springframework.mock.web.MockHttpSession
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.http.MediaType
import com.nimbusds.jwt.SignedJWT
import kotlin.test.assertEquals
import kotlin.test.assertFalse

@SpringBootTest
@AutoConfigureMockMvc
class AuthIntegrationTest {
    @Autowired lateinit var mvc: MockMvc
    @Autowired lateinit var users: WorldUsers
    @Autowired lateinit var json: ObjectMapper

    companion object {
        private val directory = Files.createTempDirectory("world-auth-test")
        @JvmStatic @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("world.database.path") { directory.resolve("test.db").toString() }
            registry.add("world.auth.key-path") { directory.resolve("key.json").toString() }
            registry.add("world.auth.demo-password") { "test-only-password" }
            registry.add("spring.cloud.nacos.config.enabled") { "false" }
        }
    }

    @Test fun `discovery and public JWKS are available`() {
        mvc.perform(get("/.well-known/openid-configuration"))
            .andExpect(status().isOk).andExpect(jsonPath("$.issuer").value("http://localhost:8080"))
            .andExpect(jsonPath("$.end_session_endpoint").value("http://localhost:8080/connect/logout"))
        mvc.perform(get("/oauth2/jwks")).andExpect(status().isOk)
            .andExpect(jsonPath("$.keys[0].kty").value("RSA"))
            .andExpect(jsonPath("$.keys[0].d").doesNotExist())
    }

    @Test fun `API ignores login session and login requires CSRF`() {
        val session = MockHttpSession().apply {
            val principal = users.loadUserByUsername("demo")
            setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextImpl(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.authorities)))
        }
        mvc.perform(get("/api/v1/me").session(session))
            .andExpect(status().isUnauthorized)
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.status").value(401))
        mvc.perform(post("/login").param("username", "demo").param("passwordDigest", PasswordDigests.sha256("test-only-password")))
            .andExpect(status().isForbidden)
    }

    @Test fun `plain and missing PKCE are rejected`() {
        for (method in listOf("plain", "")) {
            mvc.perform(get("/oauth2/authorize").queryParam("response_type", "code").queryParam("client_id", "world-web")
                .queryParam("redirect_uri", "http://localhost:5173/auth/callback").queryParam("scope", "openid world")
                .queryParam("code_challenge", "a".repeat(43)).queryParam("code_challenge_method", method)
                .session(login()))
                .andExpect(status().isBadRequest)
        }
    }

    @Test fun `registration normalizes email rejects duplicates and accepts only digest login`() {
        val name = "registered_user"
        val digest = PasswordDigests.sha256("registration-test-password")
        fun register(username: String, email: String, passwordDigest: String = digest) = post("/api/v1/auth/register")
            .contentType(MediaType.APPLICATION_JSON)
            .content(json.writeValueAsString(mapOf("username" to username, "email" to email, "passwordDigest" to passwordDigest)))
        mvc.perform(register(name, " Person@Example.COM "))
            .andExpect(status().isCreated).andExpect(jsonPath("$.username").value(name))
            .andExpect(jsonPath("$.email").value("person@example.com"))
            .andExpect(jsonPath("$.passwordDigest").doesNotExist())
        mvc.perform(register(name, "other@example.com")).andExpect(status().isConflict)
        mvc.perform(register("another_user", "PERSON@example.com")).andExpect(status().isConflict)
        mvc.perform(register("raw_user", "raw@example.com", "raw-password")).andExpect(status().isBadRequest)
        mvc.perform(register("upper_user", "upper@example.com", digest.uppercase())).andExpect(status().isBadRequest)
        mvc.perform(register("invalid_email", "not-an-email")).andExpect(status().isBadRequest)
        val user = users.loadUserByUsername(name)
        assertEquals(PasswordDigests.SCHEME, user.credentialScheme)
        assertEquals("person@example.com", users.me(user.id).email)
        mvc.perform(post("/login").with(csrf()).param("username", name).param("password", "registration-test-password"))
            .andExpect(redirectedUrl("/login?error"))
        mvc.perform(post("/login").with(csrf()).param("username", name).param("passwordDigest", digest))
            .andExpect(status().is3xxRedirection).andExpect(header().string("Location", "/"))
    }

    @Test fun `login page hashes password without submitting a raw password field`() {
        val html = mvc.perform(get("/login")).andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML)).andReturn().response.contentAsString
        kotlin.test.assertTrue(html.contains("crypto.subtle.digest('SHA-256'"))
        kotlin.test.assertTrue(html.contains("name=\"passwordDigest\""))
        assertFalse(html.contains("name=\"password\""))
        kotlin.test.assertTrue(html.contains("name=\"_csrf\""))
    }

    private fun login(): MockHttpSession = mvc.perform(post("/login").with(csrf())
        .param("username", "demo").param("passwordDigest", PasswordDigests.sha256("test-only-password")))
        .andExpect(status().is3xxRedirection).andReturn().request.getSession(false) as MockHttpSession

    private fun authorizationCode(verifier: String, scope: String): String {
        val challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        val result = mvc.perform(get("/oauth2/authorize").queryParam("response_type", "code")
            .queryParam("client_id", "world-web").queryParam("redirect_uri", "http://localhost:5173/auth/callback")
            .queryParam("scope", scope).queryParam("code_challenge", challenge).queryParam("code_challenge_method", "S256")
            .queryParam("nonce", "test-nonce").queryParam("state", "test-state")
            .session(login()))
            .andExpect(status().is3xxRedirection).andReturn()
        val query = URI(result.response.redirectedUrl!!).rawQuery.split("&").associate {
            val pair = it.split("=", limit = 2)
            pair[0] to URLDecoder.decode(pair[1], Charsets.UTF_8)
        }
        return requireNotNull(query["code"]) { "Authorization must return a code" }
    }

    private fun exchange(code: String, verifier: String) = post("/oauth2/token")
        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
        .param("grant_type", "authorization_code").param("client_id", "world-web")
        .param("redirect_uri", "http://localhost:5173/auth/callback").param("code", code).param("code_verifier", verifier)

    @Test fun `S256 flow issues UUID subject access token and rejects ID token`() {
        val verifier = "b".repeat(64)
        val code = authorizationCode(verifier, "openid profile world")
        val response = mvc.perform(exchange(code, verifier)).andExpect(status().isOk).andReturn().response.contentAsString
        val tokens = json.readTree(response)
        val access = tokens["access_token"].asText()
        val idClaims = SignedJWT.parse(tokens["id_token"].asText()).jwtClaimsSet
        assertEquals("test-nonce", idClaims.getStringClaim("nonce"))
        assertEquals(listOf("world-web"), idClaims.audience)
        assertEquals(users.loadUserByUsername("demo").id, idClaims.subject)
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer $access"))
            .andExpect(status().isOk).andExpect(jsonPath("$.id").value(users.loadUserByUsername("demo").id))
            .andExpect(jsonPath("$.username").value("demo"))
        mvc.perform(get("/userinfo").header("Authorization", "Bearer $access"))
            .andExpect(status().isOk).andExpect(jsonPath("$.sub").value(users.loadUserByUsername("demo").id))
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer ${tokens["id_token"].asText()}"))
            .andExpect(status().isUnauthorized)
        assertFalse(tokens.has("refresh_token"))
        mvc.perform(exchange(code, verifier)).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_grant"))
    }

    @Test fun `wrong verifier fails and token without world scope is forbidden`() {
        val verifier = "c".repeat(64)
        val firstCode = authorizationCode(verifier, "openid world")
        mvc.perform(exchange(firstCode, "d".repeat(64))).andExpect(status().isBadRequest)
        val secondCode = authorizationCode(verifier, "openid profile")
        val tokens = json.readTree(mvc.perform(exchange(secondCode, verifier)).andExpect(status().isOk).andReturn().response.contentAsString)
        mvc.perform(get("/api/v1/me").header("Authorization", "Bearer ${tokens["access_token"].asText()}"))
            .andExpect(status().isForbidden)
            .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.status").value(403))
    }

    @Test fun `wrong password cannot authenticate and invalid redirect never leaves server`() {
        val failed = mvc.perform(post("/login").with(csrf()).param("username", "demo").param("passwordDigest", PasswordDigests.sha256("wrong-password")))
            .andExpect(redirectedUrl("/login?error")).andReturn().request.getSession(false) as MockHttpSession
        mvc.perform(get("/api/v1/me").session(failed)).andExpect(status().isUnauthorized)
        mvc.perform(get("/oauth2/authorize").queryParam("response_type", "code").queryParam("client_id", "world-web")
            .queryParam("redirect_uri", "https://unregistered.example/callback").queryParam("scope", "openid world")
            .queryParam("code_challenge", "a".repeat(43)).queryParam("code_challenge_method", "S256").session(login()))
            .andExpect(status().isBadRequest).andExpect(header().doesNotExist("Location"))
    }

    @Test fun `API errors do not disclose bearer input and PATCH preflight is allowed only from configured origin`() {
        val secret = "malformed-secret-token"
        val response = mvc.perform(get("/api/v1/me").header("Authorization", "Bearer $secret"))
            .andExpect(status().isUnauthorized).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.status").value(401)).andExpect(header().string("WWW-Authenticate", "Bearer"))
            .andReturn().response
        assertFalse(response.contentAsString.contains(secret))
        assertFalse(response.contentAsString.contains("http"))
        mvc.perform(options("/api/v1/events/event/photos/photo/placement").header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "PATCH").header("Access-Control-Request-Headers", "authorization,content-type"))
            .andExpect(status().isOk).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
            .andExpect(header().string("Access-Control-Allow-Methods", org.hamcrest.Matchers.containsString("PATCH")))
            .andExpect(header().doesNotExist("Access-Control-Allow-Credentials"))
        mvc.perform(options("/api/v1/me").header("Origin", "https://untrusted.example")
            .header("Access-Control-Request-Method", "GET"))
            .andExpect(status().isForbidden).andExpect(header().doesNotExist("Access-Control-Allow-Origin"))
    }
}
