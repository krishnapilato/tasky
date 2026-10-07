package io.github.krishnapilato.tasky.task;

import io.github.krishnapilato.tasky.core.Problem;

public record Subtask(String title, boolean done) {
    public Subtask {
        title = title == null ? "" : title.strip();
        if (title.isEmpty() || title.length() > 200) throw new Problem(422, "Give each subtask a title of up to 200 characters");
    }

    public Subtask reset() {
        return new Subtask(title, false);
    }
}
