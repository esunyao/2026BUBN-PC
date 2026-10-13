package cn.commonagora.world.auth

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.web.filter.OncePerRequestFilter

/** Reject downgrade to plain PKCE before any login or redirect. SAS verifies the verifier at exchange. */
class PkceS256Filter : OncePerRequestFilter() {
    override fun shouldNotFilter(request: HttpServletRequest) = request.requestURI.removePrefix(request.contextPath) != "/oauth2/authorize"

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val challenge = request.getParameter("code_challenge")
        if (request.getParameterValues("code_challenge_method")?.toList() != listOf("S256") ||
            request.getParameterValues("code_challenge")?.size != 1 ||
            challenge == null || !challenge.matches(Regex("[A-Za-z0-9_-]{43}"))) {
            response.status = 400
            response.contentType = "application/json"
            response.writer.write("{\"error\":\"invalid_request\",\"error_description\":\"PKCE S256 is required\"}")
            return
        }
        chain.doFilter(request, response)
    }
}
