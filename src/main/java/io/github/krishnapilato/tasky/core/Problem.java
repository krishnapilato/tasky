package io.github.krishnapilato.tasky.core;

public final class Problem extends RuntimeException {
    private final int status;

    public Problem(int status, String message) {
        if (status < 400 || status > 599) throw new IllegalArgumentException("Not an error status: " + status);
        super(message, null, false, false);
        this.status = status;
    }

    public int status() {
        return status;
    }
}
