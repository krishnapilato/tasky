package io.github.krishnapilato.tasky.model;

import module java.base;

public record Task(Long id, String title, String notes, LocalDate due, Priority priority, boolean done) {

    public Task {
        title = Objects.requireNonNullElse(title, "").strip();
        notes = Objects.requireNonNullElse(notes, "").strip();
        priority = Objects.requireNonNullElse(priority, Priority.NONE);
    }

    public Task withId(long newId) {
        return new Task(newId, title, notes, due, priority, done);
    }
}