package io.github.krishnapilato.tasky;

import module java.base;
import module java.management;
import io.javalin.Javalin;
import org.slf4j.LoggerFactory;

public final class Tasky {

    void main() throws IOException {
        Seed.load();
        var app = Javalin.create(Routes::configure).start(Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")));
        LoggerFactory.getLogger(Tasky.class).info("Tasky is running on http://localhost:{} with Java {} (started in {} ms)",
                app.port(), Runtime.version().feature(), ManagementFactory.getRuntimeMXBean().getUptime());
    }
}