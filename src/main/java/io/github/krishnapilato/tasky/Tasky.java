package io.github.krishnapilato.tasky;

import io.github.krishnapilato.tasky.web.Server;

public class Tasky {

    void main() throws Exception {
        Seed.load();
        Server.run(Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")));
    }
}