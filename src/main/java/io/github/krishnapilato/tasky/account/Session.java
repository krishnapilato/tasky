package io.github.krishnapilato.tasky.account;

import module java.base;
import io.github.krishnapilato.tasky.core.Problem;

public record Session(long userId, ZoneId zone) {
    private static final ScopedValue<Session> CURRENT = ScopedValue.newInstance();

    public static Session current() {
        return CURRENT.orElseThrow(() -> new Problem(401, "Sign in to continue"));
    }

    public static Optional<Session> active() {
        return CURRENT.isBound() ? Optional.of(CURRENT.get()) : Optional.empty();
    }

    public <T> T call(Supplier<T> work) {
        return ScopedValue.where(CURRENT, this).call(work::get);
    }

    public LocalDate today() {
        return LocalDate.now(zone);
    }

    public LocalDate dayOf(Instant moment) {
        return LocalDate.ofInstant(moment, zone);
    }
}
