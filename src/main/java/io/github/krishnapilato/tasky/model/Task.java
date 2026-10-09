package io.github.krishnapilato.tasky.model;

import jakarta.persistence.*;

import java.time.LocalDate;

@Entity
@Table(name = "tasks")
public class Task {
    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false, updatable = false)
    private long ownerId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 2000)
    private String notes;

    private LocalDate due;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Priority priority;

    private boolean done;

    protected Task() { }

    public Task(long ownerId, TaskData data) {
        this.ownerId = ownerId;
        update(data);
    }

    public long ownerId() {
        return ownerId;
    }

    public void update(TaskData data) {
        title = data.title();
        notes = data.notes();
        due = data.due();
        priority = data.priority();
        done = data.done();
    }

    public TaskData data() {
        return new TaskData(id, title, notes, due, priority, done);
    }
}
