package io.github.krishnapilato.tasky.focus;

import module java.base;
import io.github.krishnapilato.tasky.account.Session;
import io.github.krishnapilato.tasky.core.Database;
import io.github.krishnapilato.tasky.core.Problem;
import io.github.krishnapilato.tasky.task.TaskView;
import io.github.krishnapilato.tasky.task.Tasks;

public final class FocusLog {
    public record Entry(Long taskId, int minutes) {
        public Entry {
            if (minutes < 1 || minutes > 480) throw new Problem(422, "Log between 1 and 480 focused minutes");
        }
    }

    private FocusLog() {}

    public static Optional<TaskView> record(Entry entry) {
        var owner = Session.current().userId();
        return Database.call(database -> {
            database.persist(new FocusSession(owner, entry.taskId(), entry.minutes(), Instant.now()));
            return Optional.ofNullable(entry.taskId()).map(id -> Tasks.find(database, id).focus(entry.minutes()).view());
        });
    }

    public static List<FocusSession.View> history() {
        var owner = Session.current().userId();
        return Database.call(database -> database.createQuery("select f from FocusSession f where f.ownerId = :owner order by f.endedAt", FocusSession.class)
                .setParameter("owner", owner)
                .getResultStream()
                .map(FocusSession::view)
                .toList());
    }
}
