package io.github.krishnapilato.tasky.task;

import module java.base;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "tasks", indexes = @Index(columnList = "owner_id"))
public class Task {
    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false, updatable = false)
    private long ownerId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 4000)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.TODO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    private LocalDate due;

    @Enumerated(EnumType.STRING)
    @Column(name = "recurrence", nullable = false)
    private Repeat repeat;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<String> tags;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<Subtask> subtasks;

    private int focusMinutes;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant completedAt;

    protected Task() {
    }

    public Task(long ownerId, TaskDraft draft, Instant createdAt) {
        this.ownerId = ownerId;
        this.createdAt = createdAt.truncatedTo(ChronoUnit.MILLIS);
        edit(draft);
    }

    public long ownerId() {
        return ownerId;
    }

    public Status status() {
        return status;
    }

    public TaskView view() {
        return new TaskView(id, title, notes, status, priority, due, repeat, tags, subtasks, focusMinutes, createdAt, completedAt);
    }

    public void edit(TaskDraft draft) {
        title = draft.title();
        notes = draft.notes();
        priority = draft.priority();
        due = draft.due();
        repeat = draft.repeat();
        tags = draft.tags();
        subtasks = draft.subtasks();
    }

    public void move(Status target, Instant moment) {
        completedAt = target != Status.DONE ? null : Objects.requireNonNullElse(completedAt, moment.truncatedTo(ChronoUnit.MILLIS));
        status = target;
    }

    public Task focus(int minutes) {
        focusMinutes += minutes;
        return this;
    }

    public Optional<Task> successor(LocalDate today) {
        var draft = new TaskDraft(title, notes, priority, due, repeat, tags, subtasks);
        return repeat.next(due, today).map(next -> new Task(ownerId, draft.rescheduled(next), Instant.now()));
    }
}
