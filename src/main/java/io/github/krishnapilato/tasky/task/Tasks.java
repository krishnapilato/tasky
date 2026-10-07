package io.github.krishnapilato.tasky.task;

import module java.base;
import io.github.krishnapilato.tasky.account.Session;
import io.github.krishnapilato.tasky.core.Database;
import io.github.krishnapilato.tasky.core.Problem;
import jakarta.persistence.EntityManager;

public final class Tasks {
    public record Move(Status status) {
        public Move {
            if (status == null) throw new Problem(422, "Choose a status: todo, doing or done");
        }
    }

    public record Moved(TaskView task, TaskView next) {}

    private Tasks() {}

    public static List<TaskView> list() {
        var owner = Session.current().userId();
        return Database.call(database -> database.createQuery("select t from Task t where t.ownerId = :owner order by t.createdAt, t.id", Task.class)
                .setParameter("owner", owner)
                .getResultStream()
                .map(Task::view)
                .toList());
    }

    public static TaskView create(TaskDraft draft) {
        var task = new Task(Session.current().userId(), draft, Instant.now());
        Database.run(database -> database.persist(task));
        return task.view();
    }

    public static TaskView edit(long id, TaskDraft draft) {
        return Database.call(database -> {
            var task = find(database, id);
            task.edit(draft);
            return task.view();
        });
    }

    public static Moved move(long id, Status target) {
        var today = Session.current().today();
        return Database.call(database -> {
            var task = find(database, id);
            var finishing = target == Status.DONE && task.status() != Status.DONE;
            task.move(target, Instant.now());
            var next = finishing ? task.successor(today) : Optional.<Task>empty();
            next.ifPresent(database::persist);
            return new Moved(task.view(), next.map(Task::view).orElse(null));
        });
    }

    public static void delete(long id) {
        Database.run(database -> database.remove(find(database, id)));
    }

    public static Task find(EntityManager database, long id) {
        return Optional.ofNullable(database.find(Task.class, id))
                .filter(task -> task.ownerId() == Session.current().userId())
                .orElseThrow(() -> new Problem(404, "Task not found"));
    }
}
