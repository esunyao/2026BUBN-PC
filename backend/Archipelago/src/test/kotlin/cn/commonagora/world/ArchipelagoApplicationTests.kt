package cn.commonagora.world

import org.junit.jupiter.api.Test
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import java.nio.file.Files

@SpringBootTest
class ArchipelagoApplicationTests {

    companion object {
        private val directory = Files.createTempDirectory("world-context-test")
        @JvmStatic @DynamicPropertySource
        fun properties(registry: DynamicPropertyRegistry) {
            registry.add("world.database.path") { directory.resolve("test.db").toString() }
            registry.add("world.auth.key-path") { directory.resolve("key.json").toString() }
        }
    }

    @Test
    fun contextLoads() {
    }

}
