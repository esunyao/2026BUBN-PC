package cn.commonagora.world.media

import cn.commonagora.world.config.StorageProperties
import cn.commonagora.world.shared.ApiException
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import java.net.InetSocketAddress
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.test.*

class RustFsStorageGatewayTests {
    private fun properties(endpoint: String = "http://127.0.0.1:1") = StorageProperties(
        enabled = true, endpoint = endpoint, publicEndpoint = "https://photos.example:9443",
        accessKey = "test-access", secretKey = "test-secret", bucket = "world-photos")

    @Test
    fun `real SDK produces SigV4 path style browser endpoint without checksum upload requirements`() {
        val gateway = RustFsStorageGateway(properties())
        try {
            val key = "owners/owner/events/event/staging/object"
            val upload = gateway.signUpload(key, "image/webp", Duration.ofMinutes(5))
            val uri = URI(upload.url)
            val query = query(uri)
            assertEquals("photos.example", uri.host)
            assertEquals(9443, uri.port)
            assertEquals("/world-photos/$key", uri.path)
            assertEquals("AWS4-HMAC-SHA256", query["X-Amz-Algorithm"])
            assertEquals("300", query["X-Amz-Expires"])
            assertTrue(query.getValue("X-Amz-Credential").startsWith("test-access/"))
            assertTrue(query.getValue("X-Amz-Credential").endsWith("/us-east-1/s3/aws4_request"))
            assertEquals(64, query.getValue("X-Amz-Signature").length)
            assertEquals("image/webp", upload.headers.entries.first { it.key.equals("content-type", true) }.value)
            assertFalse(upload.headers.keys.any { it.equals("host", true) || it.contains("checksum", true) })
            query.getValue("X-Amz-SignedHeaders").split(';').filter { it != "host" }.forEach { name ->
                assertTrue(upload.headers.keys.any { it.equals(name, true) }, "Missing required signed header: $name")
            }
            val download = URI(gateway.signDownload(key.replace("staging", "photos"), Duration.ofMinutes(15)))
            assertEquals("900", query(download)["X-Amz-Expires"])
            assertEquals("host", query(download)["X-Amz-SignedHeaders"])
            assertFalse(download.rawQuery.contains("checksum", true))
        } finally { gateway.close() }
    }

    @Test
    fun `disabled storage rejects signing without creating SDK clients`() {
        val gateway = RustFsStorageGateway(StorageProperties())
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
            assertFailsWith<ApiException> { gateway.signDownload("ignored", Duration.ofMinutes(15)) }.status)
        gateway.close()
    }

    @Test
    fun `SDK HEAD and conditional COPY use internal endpoint and map safe failures`() {
        val calls = CopyOnWriteArrayList<String>()
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange ->
            calls.add("${exchange.requestMethod} ${exchange.requestURI.path}")
            when {
                exchange.requestURI.path.endsWith("missing") -> exchange.sendResponseHeaders(404, -1)
                exchange.requestURI.path.endsWith("denied") -> exchange.sendResponseHeaders(403, -1)
                exchange.requestMethod == "HEAD" -> {
                    exchange.responseHeaders.add("Content-Type", "image/jpeg")
                    exchange.responseHeaders.add("Content-Length", "42")
                    exchange.responseHeaders.add("ETag", "\"source\"")
                    exchange.sendResponseHeaders(200, -1)
                }
                else -> {
                    assertEquals("/world-photos/owners/o/events/e/staging/source",
                        exchange.requestHeaders.getFirst("x-amz-copy-source").let { if (it.startsWith('/')) it else "/$it" })
                    assertEquals("\"source\"", exchange.requestHeaders.getFirst("x-amz-copy-source-if-match"))
                    val body = "<CopyObjectResult><ETag>&quot;copied&quot;</ETag><LastModified>2026-10-13T00:00:00Z</LastModified></CopyObjectResult>".toByteArray()
                    exchange.responseHeaders.add("Content-Type", "application/xml")
                    exchange.sendResponseHeaders(200, body.size.toLong())
                    exchange.responseBody.write(body)
                }
            }
            exchange.close()
        }
        server.start()
        val gateway = RustFsStorageGateway(properties("http://127.0.0.1:${server.address.port}"))
        try {
            assertEquals(StoredObject(42, "image/jpeg", "\"source\""), gateway.head("owners/o/events/e/staging/source"))
            assertEquals("\"copied\"", gateway.copy("owners/o/events/e/staging/source", "owners/o/events/e/photos/final", "\"source\""))
            assertEquals(HttpStatus.NOT_FOUND, assertFailsWith<ApiException> { gateway.head("missing") }.status)
            val failed = assertFailsWith<ApiException> { gateway.head("denied") }
            assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failed.status)
            assertEquals("Photo storage is unavailable", failed.message)
            assertTrue(calls.all { it.contains("/world-photos/") })
        } finally {
            gateway.close()
            server.stop(0)
        }
    }

    private fun query(uri: URI): Map<String, String> = uri.rawQuery.split('&').associate {
        val pair = it.split('=', limit = 2)
        URLDecoder.decode(pair[0], StandardCharsets.UTF_8) to URLDecoder.decode(pair[1], StandardCharsets.UTF_8)
    }
}
