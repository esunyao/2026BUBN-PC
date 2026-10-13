package cn.commonagora.world.integration

import cn.commonagora.world.auth.SigningKeys
import cn.commonagora.world.auth.WorldUsers
import cn.commonagora.world.media.*
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import tools.jackson.databind.ObjectMapper
import java.nio.file.Files
import java.time.Duration
import java.time.Instant
import java.util.Date
import java.util.UUID
import kotlin.test.assertEquals

/** Tests the HTTP contract and authenticated application flow, with a metadata-only bucket double. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(WorldApiTest.StorageFixture::class)
class WorldApiTest {
    @Autowired lateinit var mvc: MockMvc
    @Autowired lateinit var json: ObjectMapper
    @Autowired lateinit var users: WorldUsers
    @Autowired lateinit var keys: SigningKeys
    @Autowired lateinit var jdbc: JdbcTemplate
    @Autowired lateinit var bucket: MemoryBucket

    companion object {
        private val directory = Files.createTempDirectory("world-api-test")
        @JvmStatic @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("world.database.path") { directory.resolve("world.db").toString() }
            registry.add("world.auth.key-path") { directory.resolve("key.json").toString() }
            registry.add("world.auth.demo-password") { "test-only-password" }
            registry.add("spring.cloud.nacos.config.enabled") { "false" }
        }
    }

    @Test
    fun `HTTP event upload confirmation placement and download contract preserves ownership`() {
        val token = token(users.loadUserByUsername("demo").id)
        val event = postJson("/api/v1/events", token, """{"name":"共同事件"}""", 201)
        val eventId = event["id"].asText()
        val base = "/api/v1/events/$eventId"
        val author = postJson("$base/participants", token, """{"name":"旅伴","color":"#aabbcc"}""", 201)
        val photoRequest = """{"photographerId":"${author["id"].asText()}","filename":"memory.jpg","contentType":"image/jpeg","sizeBytes":42,"caption":"回忆"}"""
        val intent = postJson("$base/photos/presign", token, photoRequest, 201)
        val photoId = intent["photoId"].asText()
        assertEquals(setOf("photoId", "uploadUrl", "headers", "expiresAt"), intent.properties().map { it.key }.toSet())
        mvc.perform(get(base).header("Authorization", "Bearer $token"))
            .andExpect(status().isOk).andExpect(jsonPath("$.photos.length()").value(0))

        val staged = jdbc.queryForObject("SELECT staging_key FROM photos WHERE id=?", String::class.java, photoId)!!
        bucket.objects[staged] = StoredObject(42, "image/jpeg", "test-etag")
        val confirmed = postJson("$base/photos/$photoId/confirm", token, null, 200)
        assertEquals(photoId, confirmed["id"].asText())
        assertEquals(true, confirmed["capturedAt"].isNull)
        assertEquals(true, confirmed["gps"].isNull)
        assertEquals(true, confirmed["islandId"].isNull)
        val copies = bucket.copies
        postJson("$base/photos/$photoId/confirm", token, null, 200)
        assertEquals(copies, bucket.copies)

        val placed = mvc.perform(patch("$base/photos/$photoId/placement")
            .header("Authorization", "Bearer $token").contentType("application/json")
            .content("""{"newPlaceName":"共同地点"}"""))
            .andExpect(status().isOk).andReturn().response.contentAsString.let(json::readTree)
        mvc.perform(get(base).header("Authorization", "Bearer $token"))
            .andExpect(status().isOk).andExpect(jsonPath("$.photos[0].islandId").value(placed["islandId"].asText()))
            .andExpect(jsonPath("$.islands[0].position.x").value(230.0))
            .andExpect(jsonPath("$.islands[0].position.y").value(180.0))
            .andExpect(jsonPath("$.islands[0].gpsAnchor").isEmpty())
        val downloads = postJson("$base/photos/download-urls", token, """{"photoIds":["$photoId"]}""", 200)
        assertEquals(photoId, downloads["urls"][0]["photoId"].asText())

        val otherId = UUID.randomUUID().toString()
        jdbc.update("INSERT INTO users(id,username,password_hash,created_at) VALUES(?,?,?,?)", otherId, "other-$otherId", "test-hash", 1L)
        val other = token(otherId)
        mvc.perform(get(base).header("Authorization", "Bearer $other"))
            .andExpect(status().isNotFound).andExpect(content().contentTypeCompatibleWith("application/problem+json"))
            .andExpect(jsonPath("$.status").value(404))
        postJson("$base/photos/download-urls", other, """{"photoIds":["$photoId"]}""", 404)
        postJson("$base/photos/presign", other, photoRequest, 404)
        postJson("$base/photos/presign", token, photoRequest.replace("image/jpeg", "video/mp4"), 400)
        postJson("$base/photos/presign", token, "{}", 400)
    }

    private fun postJson(path: String, token: String, body: String?, expectedStatus: Int) = mvc.perform(
        post(path).header("Authorization", "Bearer $token").apply {
            if (body != null) contentType("application/json").content(body)
        }
    ).andExpect(status().`is`(expectedStatus)).andReturn().response.contentAsString.let(json::readTree)

    private fun token(subject: String): String {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder().subject(subject).issuer("http://localhost:8080")
            .audience("world-api").issueTime(Date.from(now)).expirationTime(Date.from(now.plusSeconds(600)))
            .claim("token_use", "access_token").claim("scope", "world").build()
        return SignedJWT(JWSHeader.Builder(JWSAlgorithm.RS256).keyID(keys.rsa.keyID).build(), claims)
            .apply { sign(RSASSASigner(keys.rsa)) }.serialize()
    }

    @TestConfiguration
    class StorageFixture {
        @Bean @Primary fun storageFixture() = MemoryBucket()
    }

    class MemoryBucket : StorageGateway {
        val objects = mutableMapOf<String, StoredObject>()
        var copies = 0
        override fun requireAvailable() = Unit
        override fun signUpload(key: String, contentType: String, ttl: Duration) =
            UploadSignature("http://localhost:9000/test/$key", mapOf("Content-Type" to contentType))
        override fun head(key: String): StoredObject = requireNotNull(objects[key])
        override fun copy(sourceKey: String, finalKey: String, etag: String): String {
            val source = head(sourceKey)
            assertEquals(etag, source.etag)
            objects[finalKey] = source
            copies++
            return etag
        }
        override fun signDownload(key: String, ttl: Duration) = "http://localhost:9000/test/$key"
    }
}
