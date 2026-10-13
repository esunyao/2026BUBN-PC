# Configuration

Runtime baseline is Spring Boot 4.1.0, Kotlin 2.3.21 and Java 21, with Spring Cloud 2025.1.2 and Alibaba 2025.1.0.0. The Cloud compatibility checker remains enabled. Nacos configuration uses an optional import, is disabled by default, and does not refresh. Service discovery is absent.

`NACOS_SERVER_ADDR`, `NACOS_NAMESPACE` (namespace ID; empty selects public), `NACOS_GROUP`, `NACOS_USERNAME`, `NACOS_PASSWORD` and `NACOS_TIMEOUT` configure the optional `archipelago.yaml` import. The fetch timeout defaults to 3000ms. When the enabled server is unavailable the optional import falls back to local configuration; Nacos client initialization and connection retries can add startup time beyond the fetch timeout. The test suite starts the actual application against an unreachable loopback endpoint and checks fallback within 45 seconds.

The official `springboot4-dotenv` 5.1.0 processor loads the ignored local `.env`; operating system environment values have higher precedence. Set initial demo credentials and storage/Nacos secrets locally or through deployment environment variables. `.env.example` contains names and safe defaults only; `.env` is optional when deployment environment values are present.

world.database.path identifies the local SQLite file. A single Hikari connection uses foreign_keys=ON, WAL and a 5000ms busy timeout. Flyway automatically applies the checked-in migrations during startup. SQLite data and signing keys belong in the ignored data directory.

world.storage defaults to disabled. Enabled storage requires internal and public HTTP(S) endpoints, access key, secret key, bucket and region. Maximum size defaults to 20MiB, upload TTL to five minutes and download TTL to fifteen minutes. Credentials must come from deployment environment or ignored .env. See the root `.env.example` for variable names; never publish a real password or key.

Enabled endpoints reject user information, query strings and fragments. File size must be positive; each signing TTL must be between one second and seven days (the SigV4 maximum). Invalid configuration fails startup with generic validation messages. Disabled storage accepts missing credentials and leaves the event API usable.
