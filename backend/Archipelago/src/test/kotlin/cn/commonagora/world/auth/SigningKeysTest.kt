package cn.commonagora.world.auth

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Path
import kotlin.test.assertEquals
import kotlin.test.assertFails

class SigningKeysTest {
    @TempDir lateinit var directory: Path
    @Test fun `restart reuses private key and kid`() {
        val path = directory.resolve("key.json")
        val first = SigningKeys.loadOrCreate(path)
        val second = SigningKeys.loadOrCreate(path)
        assertEquals(first.keyID, second.keyID)
        assertEquals(first.toRSAPublicKey(), second.toRSAPublicKey())
        assertEquals(first.toRSAPrivateKey(), second.toRSAPrivateKey())
    }
    @Test fun `corrupt existing key fails instead of rotating silently`() {
        val path = directory.resolve("key.json")
        java.nio.file.Files.writeString(path, "invalid")
        assertFails { SigningKeys.loadOrCreate(path) }
    }
}
