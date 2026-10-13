package cn.commonagora.world.shared

import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.dao.DataIntegrityViolationException
import org.slf4j.LoggerFactory

@RestControllerAdvice
class ApiExceptionHandler {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(ApiException::class)
    fun business(error: ApiException): ProblemDetail = ProblemDetail.forStatusAndDetail(error.status, error.message)

    @ExceptionHandler(MethodArgumentNotValidException::class, HttpMessageNotReadableException::class)
    fun invalid(error: Exception): ProblemDetail = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "请求字段无效")

    @ExceptionHandler(DataIntegrityViolationException::class)
    fun conflict(error: DataIntegrityViolationException): ProblemDetail =
        ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, "记录冲突，请刷新后重试")

    @ExceptionHandler(Exception::class)
    fun unexpected(error: Exception): ProblemDetail {
        log.error("API request failed: {}", error.javaClass.simpleName)
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "服务暂时无法完成请求")
    }
}
