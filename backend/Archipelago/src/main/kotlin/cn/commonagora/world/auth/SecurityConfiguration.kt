package cn.commonagora.world.auth

import cn.commonagora.world.config.AuthProperties
import com.nimbusds.jose.jwk.JWKSet
import com.nimbusds.jose.jwk.source.JWKSource
import com.nimbusds.jose.proc.SecurityContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.annotation.Order
import org.springframework.http.MediaType
import org.springframework.security.config.Customizer
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.core.*
import org.springframework.security.oauth2.core.oidc.OidcScopes
import org.springframework.security.oauth2.jwt.*
import org.springframework.security.oauth2.server.authorization.OAuth2AuthorizationService
import org.springframework.security.oauth2.server.authorization.InMemoryOAuth2AuthorizationService
import org.springframework.security.oauth2.server.authorization.client.*
import org.springframework.security.config.annotation.web.configurers.oauth2.server.authorization.OAuth2AuthorizationServerConfigurer
import org.springframework.security.oauth2.server.authorization.settings.*
import org.springframework.security.oauth2.server.authorization.token.JwtEncodingContext
import org.springframework.security.oauth2.server.authorization.token.OAuth2TokenCustomizer
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.LoginUrlAuthenticationEntryPoint
import org.springframework.security.web.context.SecurityContextHolderFilter
import org.springframework.security.web.util.matcher.MediaTypeRequestMatcher
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import java.time.Duration

@Configuration
class SecurityConfiguration(private val properties: AuthProperties) {
    @Bean @Order(1)
    fun authorizationChain(http: HttpSecurity): SecurityFilterChain {
        val server = OAuth2AuthorizationServerConfigurer()
        http.securityMatcher(server.endpointsMatcher)
            .with(server) { it.oidc(Customizer.withDefaults()) }
            .authorizeHttpRequests { it.anyRequest().authenticated() }
            .cors(Customizer.withDefaults())
            .exceptionHandling {
                it.defaultAuthenticationEntryPointFor(LoginUrlAuthenticationEntryPoint("/login"), MediaTypeRequestMatcher(MediaType.TEXT_HTML))
            }
            .oauth2ResourceServer { it.jwt(Customizer.withDefaults()) }
            .addFilterBefore(PkceS256Filter(), SecurityContextHolderFilter::class.java)
        return http.build()
    }

    @Bean @Order(2)
    fun apiChain(http: HttpSecurity): SecurityFilterChain {
        http.securityMatcher("/api/v1/**")
            .csrf { it.disable() }
            .cors(Customizer.withDefaults())
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests { it.anyRequest().hasAuthority("SCOPE_world") }
            .oauth2ResourceServer {
                it.jwt(Customizer.withDefaults())
                    .authenticationEntryPoint { _, response, _ -> ApiSecurityErrors.unauthorized(response) }
                    .accessDeniedHandler { _, response, _ -> ApiSecurityErrors.forbidden(response) }
            }
            .exceptionHandling {
                it.authenticationEntryPoint { _, response, _ -> ApiSecurityErrors.unauthorized(response) }
                    .accessDeniedHandler { _, response, _ -> ApiSecurityErrors.forbidden(response) }
            }
        return http.build()
    }

    @Bean @Order(3)
    fun browserChain(http: HttpSecurity): SecurityFilterChain {
        http.authorizeHttpRequests { it.requestMatchers("/login", "/error").permitAll().anyRequest().denyAll() }
            .formLogin(Customizer.withDefaults())
        return http.build()
    }

    @Bean
    fun clients(): RegisteredClientRepository = InMemoryRegisteredClientRepository(
        RegisteredClient.withId("world-web").clientId("world-web")
            .clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri(properties.redirectUri).postLogoutRedirectUri(properties.postLogoutRedirectUri)
            .scope(OidcScopes.OPENID).scope(OidcScopes.PROFILE).scope("world")
            .clientSettings(ClientSettings.builder().requireProofKey(true).requireAuthorizationConsent(false).build())
            .tokenSettings(TokenSettings.builder().accessTokenTimeToLive(Duration.ofMinutes(10)).build())
            .build()
    )

    @Bean fun authorizations(): OAuth2AuthorizationService = InMemoryOAuth2AuthorizationService()
    @Bean fun authorizationSettings(): AuthorizationServerSettings = AuthorizationServerSettings.builder().issuer(properties.issuer).build()
    @Bean fun jwkSource(keys: SigningKeys): JWKSource<SecurityContext> = JWKSource { selector, _ -> selector.select(JWKSet(keys.rsa)) }

    @Bean
    fun jwtDecoder(keys: SigningKeys): JwtDecoder = NimbusJwtDecoder.withPublicKey(keys.rsa.toRSAPublicKey()).build().apply {
        setJwtValidator(DelegatingOAuth2TokenValidator(
            JwtTimestampValidator(Duration.ZERO),
            JwtIssuerValidator(properties.issuer),
            OAuth2TokenValidator<Jwt> { jwt ->
                if (jwt.expiresAt != null && !jwt.subject.isNullOrBlank() && jwt.audience?.contains("world-api") == true && jwt.getClaimAsString("token_use") == "access_token") OAuth2TokenValidatorResult.success()
                else OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", "A world-api access token is required", null))
            }
        ))
    }

    @Bean
    fun tokenCustomizer(users: WorldUsers): OAuth2TokenCustomizer<JwtEncodingContext> = OAuth2TokenCustomizer { context ->
        val user = users.loadUserByUsername(requireNotNull(context.getPrincipal<org.springframework.security.core.Authentication>()).name)
        context.claims.subject(user.id)
        if (context.tokenType == org.springframework.security.oauth2.server.authorization.OAuth2TokenType.ACCESS_TOKEN) {
            context.claims.audience(listOf("world-api")).claim("token_use", "access_token")
        } else {
            context.claims.claim("preferred_username", user.username)
        }
    }

    @Bean("corsConfigurationSource")
    fun corsSource(): CorsConfigurationSource = UrlBasedCorsConfigurationSource().apply {
        registerCorsConfiguration("/**", CorsConfiguration().apply {
            allowedOrigins = listOf(properties.allowedOrigin)
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("Authorization", "Content-Type")
            allowCredentials = false
        })
    }
}
