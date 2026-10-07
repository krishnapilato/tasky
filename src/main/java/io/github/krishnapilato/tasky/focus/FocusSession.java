package io.github.krishnapilato.tasky.focus;

import module java.base;
import jakarta.persistence.*;

@Entity
@Table(name = "focus_sessions", indexes = @Index(columnList = "owner_id"))
public class FocusSession {
    public record View(Long taskId, int minutes, Instant endedAt) {
    }

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false, updatable = false)
    private long ownerId;

    private Long taskId;

    private int minutes;

    @Column(nullable = false, updatable = false)
    private Instant endedAt;

    protected FocusSession() {}

    public FocusSession(long ownerId, Long taskId, int minutes, Instant endedAt) {
        this.ownerId = ownerId;
        this.taskId = taskId;
        this.minutes = minutes;
        this.endedAt = endedAt.truncatedTo(ChronoUnit.MILLIS);
    }

    public View view() {
        return new View(taskId, minutes, endedAt);
    }
}
