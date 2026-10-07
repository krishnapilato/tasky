package io.github.krishnapilato.tasky;

import io.github.krishnapilato.tasky.core.Database;
import io.github.krishnapilato.tasky.web.Server;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Tasky {
    private static final Logger LOG = LoggerFactory.getLogger(Tasky.class);

    @SuppressWarnings("resource")
    void main() throws Exception {
        Seed.read().plant();
        var server = new Server(Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")));
        Runtime.getRuntime().addShutdownHook(Thread.ofPlatform().name("shutdown").unstarted(() -> {server.close();Database.close();}));
        LOG.info("Tasky is ready on http://localhost:{}", server.port());
        server.await();
    }
}
