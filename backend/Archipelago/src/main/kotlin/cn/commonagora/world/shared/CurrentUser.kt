package cn.commonagora.world.shared

import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt

/** Only used after the resource-server filter validates the token. */
fun Jwt.userId(): String = subject?.takeIf { it.isNotBlank() }
    ?: throw ApiException(HttpStatus.UNAUTHORIZED, "令牌缺少用户身份")
