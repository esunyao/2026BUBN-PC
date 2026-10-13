package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.filter.OncePerRequestFilter

/** Bounded per-process throttling; remoteAddr is trusted, forwarded headers are not. */
class AuthRequestGuard(private val properties: AuthProperties) : OncePerRequestFilter() {
    private data class Window(val start: Long, var count: Int)
    private val windows = LinkedHashMap<String, Window>()

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val guarded = request.method == "POST" && request.servletPath in listOf("/login", "/api/v1/auth/register")
        if (!guarded) { chain.doFilter(request, response); return }
        val loopback = request.remoteAddr in listOf("127.0.0.1", "::1", "0:0:0:0:0:0:0:1") &&
            request.serverName in listOf("localhost", "127.0.0.1", "::1", "[::1]")
        if (properties.requireHttps && !request.isSecure && !(properties.allowLocalHttp && loopback)) {
            problem(response, 403, "Forbidden", "HTTPS is required for authentication")
            return
        }
        if (!allow(request.remoteAddr + ":" + request.servletPath)) {
            response.setHeader("Retry-After", "60")
            problem(response, 429, "Too Many Requests", "Authentication request limit reached; retry later")
            return
        }
        chain.doFilter(request, response)
    }

    @Synchronized private fun allow(key: String): Boolean {
        val now = System.currentTimeMillis()
        windows.entries.removeIf { now - it.value.start >= 60000 }
        val window = windows[key] ?: run {
            // Fail closed when all slots are occupied rather than allowing IP churn to evict limits.
            if (windows.size >= 4096) return false
            Window(now, 0).also { windows[key] = it }
        }
        return ++window.count <= 30
    }

    private fun problem(response: HttpServletResponse, status: Int, title: String, detail: String) {
        response.status = status
        response.contentType = "application/problem+json"
        response.writer.write("""{"type":"about:blank","title":"$title","status":$status,"detail":"$detail"}""")
    }
}
