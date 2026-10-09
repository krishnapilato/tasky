package io.github.krishnapilato.tasky.model;

import java.time.LocalDate;

public record TaskData(Long id, String title, String notes, LocalDate due, Priority priority, boolean done) {
    public TaskData {
        title = title == null ? "" : title.strip();
        notes = notes == null ? "" : notes.strip();
        priority = priority == null ? Priority.NONE : priority;
    }
}
