package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import com.nimbusds.jose.jwk.RSAKey
import org.springframework.stereotype.Component
import java.nio.file.Files
import java.nio.file.Path
import java.nio.file.StandardOpenOption
import java.security.KeyPairGenerator
import java.security.interfaces.RSAPrivateKey
import java.security.interfaces.RSAPublicKey
import java.util.UUID

/** Persist the complete private JWK locally; JWKS publishes only its public part. */
@Component
class SigningKeys(properties: AuthProperties) {
    val rsa: RSAKey = loadOrCreate(Path.of(properties.keyPath))

    companion object {
        fun loadOrCreate(path: Path): RSAKey {
            if (Files.exists(path)) return RSAKey.parse(Files.readString(path)).also {
                require(it.isPrivate && it.keyID != null) { "Signing key must be a private RSA JWK with kid" }
            }
            Files.createDirectories(path.toAbsolutePath().parent)
            val pair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
            val key = RSAKey.Builder(pair.public as RSAPublicKey).privateKey(pair.private as RSAPrivateKey)
                .keyID(UUID.randomUUID().toString()).build()
            Files.writeString(path, key.toJSONString(), StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE)
            // POSIX systems: restrict private key access. Windows operators must restrict directory ACLs.
            if (Files.getFileStore(path).supportsFileAttributeView("posix")) {
                Files.setPosixFilePermissions(path, java.nio.file.attribute.PosixFilePermissions.fromString("rw-------"))
            }
            return key
        }
    }
}
