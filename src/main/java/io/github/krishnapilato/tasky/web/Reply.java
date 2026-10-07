package io.github.krishnapilato.tasky.web;

import module java.base;

public sealed interface Reply {
    record Ok(Object body) implements Reply {}

    record Created(Object body) implements Reply {}

    record NoContent() implements Reply {}

    record Text(String contentType, String body) implements Reply {}

    record Failed(int status, String message) implements Reply {}

    static Reply of(Optional<?> body) {
        return body.<Reply>map(Ok::new).orElseGet(NoContent::new);
    }
}
