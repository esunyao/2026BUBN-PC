package cn.commonagora.world.auth

import jakarta.servlet.http.HttpServletResponse

/** Filter errors bypass controller advice; never serialize the rejected token or decoder exception. */
internal object ApiSecurityErrors {
    fun unauthorized(response: HttpServletResponse) {
        response.setHeader("WWW-Authenticate", "Bearer")
        write(response, 401, "Unauthorized", "A valid bearer access token is required")
    }
    fun forbidden(response: HttpServletResponse) {
        response.setHeader("WWW-Authenticate", """Bearer error="insufficient_scope", scope="world" """.trim())
        write(response, 403, "Forbidden", "The world scope is required")
    }
    private fun write(response: HttpServletResponse, status: Int, title: String, detail: String) {
        response.status = status
        response.contentType = "application/problem+json"
        response.writer.write("""{"type":"about:blank","title":"$title","status":$status,"detail":"$detail"}""")
    }
}
