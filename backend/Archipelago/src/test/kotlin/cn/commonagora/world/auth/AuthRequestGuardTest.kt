package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import jakarta.servlet.FilterChain
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class AuthRequestGuardTest {
    private fun request(path: String = "/api/v1/auth/register", remote: String = "127.0.0.1", host: String = "localhost") =
        MockHttpServletRequest("POST", path).apply { servletPath = path; remoteAddr = remote; serverName = host }

    @Test fun `HTTPS policy permits direct loopback and rejects insecure remote authentication`() {
        val guard = AuthRequestGuard(AuthProperties(requireHttps = true))
        var passed = false
        guard.doFilter(request(), MockHttpServletResponse(), FilterChain { _, _ -> passed = true })
        assertTrue(passed)
        val remote = MockHttpServletResponse()
        guard.doFilter(request(remote = "192.0.2.1"), remote, FilterChain { _, _ -> error("must not pass") })
        assertEquals(403, remote.status)
        val forwarded = request(remote = "192.0.2.1").apply { addHeader("X-Forwarded-Proto", "https") }
        val response = MockHttpServletResponse()
        guard.doFilter(forwarded, response, FilterChain { _, _ -> error("must not trust forwarded protocol") })
        assertEquals(403, response.status)
    }

    @Test fun `login and registration are bounded per address and endpoint`() {
        val guard = AuthRequestGuard(AuthProperties())
        repeat(30) { guard.doFilter(request(), MockHttpServletResponse(), FilterChain { _, _ -> }) }
        val response = MockHttpServletResponse()
        guard.doFilter(request(), response, FilterChain { _, _ -> error("must be throttled") })
        assertEquals(429, response.status)
        assertEquals("60", response.getHeader("Retry-After"))
        var passed = false
        guard.doFilter(request("/login"), MockHttpServletResponse(), FilterChain { _, _ -> passed = true })
        assertTrue(passed)
    }
}
