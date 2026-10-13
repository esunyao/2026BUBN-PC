package cn.commonagora.world.media

import cn.commonagora.world.config.StorageProperties
import cn.commonagora.world.shared.ApiException
import jakarta.annotation.PreDestroy
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider
import software.amazon.awssdk.core.exception.SdkException
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.s3.S3Client
import software.amazon.awssdk.services.s3.S3Configuration
import software.amazon.awssdk.services.s3.model.*
import software.amazon.awssdk.services.s3.presigner.S3Presigner
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest
import java.net.URI
import java.time.Duration

data class UploadSignature(val url: String, val headers: Map<String, String>)
data class StoredObject(val size: Long, val contentType: String?, val etag: String?)

interface StorageGateway {
    fun requireAvailable()
    fun signUpload(key: String, contentType: String, ttl: Duration): UploadSignature
    fun head(key: String): StoredObject
    fun copy(sourceKey: String, finalKey: String, etag: String): String?
    fun signDownload(key: String, ttl: Duration): String
}

/** Signing uses the browser endpoint; HEAD and COPY use the private endpoint. */
@Component
class RustFsStorageGateway(private val properties: StorageProperties) : StorageGateway {
    private val credentials by lazy {
        StaticCredentialsProvider.create(AwsBasicCredentials.create(properties.accessKey, properties.secretKey))
    }
    private val clientDelegate = lazy {
        S3Client.builder().endpointOverride(URI.create(properties.endpoint))
            .credentialsProvider(credentials).region(Region.of(properties.region))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
            .overrideConfiguration(ClientOverrideConfiguration.builder().apiCallTimeout(Duration.ofSeconds(15))
                .apiCallAttemptTimeout(Duration.ofSeconds(5)).build())
            .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
            .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED).build()
    }
    private val presignerDelegate = lazy {
        S3Presigner.builder().endpointOverride(URI.create(properties.publicEndpoint))
            .credentialsProvider(credentials).region(Region.of(properties.region))
            .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true)
                .checksumValidationEnabled(false).build()).build()
    }

    override fun requireAvailable() {
        if (!properties.enabled) throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
    }

    override fun signUpload(key: String, contentType: String, ttl: Duration): UploadSignature = storageCall {
        // No checksum algorithm or content-length header: the browser supplies the image body.
        // Every required signed header other than the browser-managed Host is returned to callers.
        val signed = presignerDelegate.value.presignPutObject(PutObjectPresignRequest.builder()
            .signatureDuration(ttl).putObjectRequest(PutObjectRequest.builder()
                .bucket(properties.bucket).key(key).contentType(contentType).build()).build())
        val headers = signed.signedHeaders().filterKeys { !it.equals("host", true) }
            .mapValues { it.value.joinToString(",") }.toMutableMap()
        if (headers.keys.none { it.equals("content-type", true) }) headers["Content-Type"] = contentType
        UploadSignature(signed.url().toExternalForm(), headers)
    }

    override fun head(key: String): StoredObject = storageCall {
        val head = clientDelegate.value.headObject(HeadObjectRequest.builder().bucket(properties.bucket).key(key).build())
        StoredObject(head.contentLength(), head.contentType(), head.eTag())
    }

    override fun copy(sourceKey: String, finalKey: String, etag: String): String? = storageCall {
        // A concurrent PUT to the staging key must not silently change the verified source.
        val copied = clientDelegate.value.copyObject(CopyObjectRequest.builder().bucket(properties.bucket)
            .key(finalKey).copySource("${properties.bucket}/$sourceKey").copySourceIfMatch(etag).build())
        copied.copyObjectResult()?.eTag()
    }

    override fun signDownload(key: String, ttl: Duration): String = storageCall {
        val signed = presignerDelegate.value.presignGetObject(GetObjectPresignRequest.builder()
            .signatureDuration(ttl).getObjectRequest(GetObjectRequest.builder().bucket(properties.bucket).key(key).build()).build())
        if (!signed.isBrowserExecutable) throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
        signed.url().toExternalForm()
    }

    private fun <T> storageCall(action: () -> T): T {
        requireAvailable()
        try {
            return action()
        } catch (e: S3Exception) {
            if (e.statusCode() == 404) throw ApiException(HttpStatus.NOT_FOUND, "Uploaded photo was not found")
            if (e.statusCode() == 412) throw ApiException(HttpStatus.BAD_REQUEST, "Uploaded photo changed; retry confirmation")
            throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
        } catch (e: SdkException) {
            throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
        }
    }

    @PreDestroy
    fun close() {
        if (clientDelegate.isInitialized()) clientDelegate.value.close()
        if (presignerDelegate.isInitialized()) presignerDelegate.value.close()
    }
}
