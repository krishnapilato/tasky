package io.github.krishnapilato.tasky.account;

import module java.base;
import io.github.krishnapilato.tasky.core.Problem;

final class Throttle {
    private record Strikes(int count, Instant since) {
        boolean expired() {
            return since.plus(WINDOW).isBefore(Instant.now());
        }
    }

    private static final int LIMIT = 8;
    private static final int CAPACITY = 10_000;
    private static final Duration WINDOW = Duration.ofMinutes(10);
    private static final Map<String, Strikes> STRIKES = new ConcurrentHashMap<>();

    private Throttle() {
    }

    static <T> T attempt(String key, Supplier<T> work) {
        var strikes = STRIKES.computeIfPresent(key, (_, known) -> known.expired() ? null : known);
        if (strikes != null && strikes.count() >= LIMIT) throw new Problem(429, "Too many attempts. Try again in a few minutes.");
        try {
            var result = work.get();
            STRIKES.remove(key);
            return result;
        } catch (Problem problem) {
            if (problem.status() == 401) strike(key);
            throw problem;
        }
    }

    private static void strike(String key) {
        if (STRIKES.size() >= CAPACITY) STRIKES.values().removeIf(Strikes::expired);
        STRIKES.merge(key, new Strikes(1, Instant.now()), (known, _) -> new Strikes(known.count() + 1, known.since()));
    }
}
