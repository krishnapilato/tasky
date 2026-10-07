package io.github.krishnapilato.tasky.task;

import module java.base;

public record TaskView(long id, String title, String notes, Status status, Priority priority, LocalDate due, Repeat repeat,
                       List<String> tags, List<Subtask> subtasks, int focusMinutes, Instant createdAt, Instant completedAt) {}
