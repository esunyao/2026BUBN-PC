package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import com.nimbusds.jose.JOSEObjectType
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import java.time.Instant
import java.util.Date
import kotlin.test.assertEquals
import kotlin.test.assertFails

class JwtValidationTest {
    @TempDir lateinit var directory: Path

    @Test fun `API validates issuer audience expiration and access token type`() {
        val properties = AuthProperties(keyPath = directory.resolve("key.json").toString())
        val keys = SigningKeys(properties)
        val decoder = SecurityConfiguration(properties).jwtDecoder(keys)
        fun token(issuer: String = properties.issuer, audience: String = "world-api", expires: Instant? = Instant.now().plusSeconds(600), type: String = "access_token", notBefore: Instant? = null): String {
            val claims = JWTClaimsSet.Builder().issuer(issuer).subject("user-id").audience(audience).claim("token_use", type)
            expires?.let { claims.expirationTime(Date.from(it)) }
            notBefore?.let { claims.notBeforeTime(Date.from(it)) }
            return SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).type(JOSEObjectType.JWT).keyID(keys.rsa.keyID).build(), claims.build())
                .apply { sign(RSASSASigner(keys.rsa)) }.serialize()
        }
        assertEquals("user-id", decoder.decode(token()).subject)
        assertFails { decoder.decode(token(issuer = "https://wrong.example")) }
        assertFails { decoder.decode(token(audience = "world-web")) }
        assertFails { decoder.decode(token(expires = Instant.now().minusSeconds(1))) }
        assertFails { decoder.decode(token(expires = null)) }
        assertFails { decoder.decode(token(type = "id_token")) }
        assertFails { decoder.decode(token(notBefore = Instant.now().plusSeconds(60))) }
        assertFails { decoder.decode(token().dropLast(5) + "abcde") }
    }
}
