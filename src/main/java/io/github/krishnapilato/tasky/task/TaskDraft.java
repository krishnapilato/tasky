package io.github.krishnapilato.tasky.task;

import module java.base;
import io.github.krishnapilato.tasky.core.Problem;

public record TaskDraft(String title, String notes, Priority priority, LocalDate due, Repeat repeat, List<String> tags, List<Subtask> subtasks) {
    public TaskDraft {
        title = Objects.requireNonNullElse(title, "").strip();
        notes = Objects.requireNonNullElse(notes, "").strip();
        priority = Objects.requireNonNullElse(priority, Priority.NONE);
        repeat = Objects.requireNonNullElse(repeat, Repeat.NONE);
        tags = Stream.ofNullable(tags).flatMap(List::stream).filter(Objects::nonNull).map(TaskDraft::tag).filter(Predicate.not(String::isEmpty)).distinct().toList();
        subtasks = Stream.ofNullable(subtasks).flatMap(List::stream).filter(Objects::nonNull).toList();
        if (title.isEmpty()) throw new Problem(422, "Give the task a title");
        if (title.length() > 200) throw new Problem(422, "Keep the title under 200 characters");
        if (notes.length() > 4000) throw new Problem(422, "Keep the notes under 4000 characters");
        if (tags.size() > 10) throw new Problem(422, "Use up to 10 tags");
        if (subtasks.size() > 50) throw new Problem(422, "Use up to 50 subtasks");
    }

    public TaskDraft rescheduled(LocalDate next) {
        return new TaskDraft(title, notes, priority, next, repeat, tags, subtasks.stream().map(Subtask::reset).toList());
    }

    private static String tag(String raw) {
        var clean = raw.strip().toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}_-]", "");
        return clean.length() > 30 ? clean.substring(0, 30) : clean;
    }
}
