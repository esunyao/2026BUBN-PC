package cn.commonagora.world.config

import com.zaxxer.hikari.HikariConfig
import com.zaxxer.hikari.HikariDataSource
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.sqlite.SQLiteConfig
import java.nio.file.Files
import java.nio.file.Path
import javax.sql.DataSource

@Configuration
@EnableConfigurationProperties(StorageProperties::class, AuthProperties::class)
class DatabaseConfiguration {
    @Bean
    fun dataSource(@Value("\${world.database.path:./data/world.db}") path: String): DataSource {
        Files.createDirectories(Path.of(path).toAbsolutePath().parent)
        val sqlite = SQLiteConfig().apply {
            enforceForeignKeys(true)
            setJournalMode(SQLiteConfig.JournalMode.WAL)
            setBusyTimeout(5000)
        }
        return HikariDataSource(HikariConfig().apply {
            jdbcUrl = "jdbc:sqlite:$path"
            driverClassName = "org.sqlite.JDBC"
            dataSourceProperties = sqlite.toProperties()
            maximumPoolSize = 1
            minimumIdle = 1
            poolName = "world-sqlite"
            connectionTestQuery = "SELECT 1"
        })
    }
}
