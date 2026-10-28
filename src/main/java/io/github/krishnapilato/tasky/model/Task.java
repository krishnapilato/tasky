package io.github.krishnapilato.tasky.model;

import module java.base;

public record Task(Long id, String title, String notes, LocalDate due, Priority priority, boolean done) {

    public Task {
        title = title == null ? "" : title.strip();
        notes = notes == null ? "" : notes.strip();
        priority = priority == null ? Priority.NONE : priority;
    }

    public Task withId(long newId) {
        return new Task(newId, title, notes, due, priority, done);
    }
}