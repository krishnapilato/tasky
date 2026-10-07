package io.github.krishnapilato.tasky;

import module java.base;
import io.github.krishnapilato.tasky.account.User;
import io.github.krishnapilato.tasky.core.Database;
import io.github.krishnapilato.tasky.core.Json;
import io.github.krishnapilato.tasky.focus.FocusSession;
import io.github.krishnapilato.tasky.task.*;

public record Seed(Account account, List<Entry> tasks, List<Focus> focus) {

    public record Account(String name, String email, String password, String recoveryKey) { }

    public record Focus(int daysAgo, int minutes) { }

    public record Entry(String title, String notes, Priority priority, Integer dueIn, Repeat repeat, List<String> tags, List<Subtask> subtasks, Status status, Integer doneAgo, int focusMinutes) {
        Task grow(long owner, LocalDate today, Instant now) {
            var due = dueIn == null ? null : today.plusDays(dueIn);
            var finished = now.minus(Objects.requireNonNullElse(doneAgo, 0), ChronoUnit.DAYS);
            var task = new Task(owner, new TaskDraft(title, notes, priority, due, repeat, tags, subtasks), finished.minus(2, ChronoUnit.DAYS));
            task.move(doneAgo != null ? Status.DONE : Objects.requireNonNullElse(status, Status.TODO), finished);
            return task.focus(focusMinutes);
        }
    }

    public static Seed read() throws IOException {
        try (var source = Seed.class.getResourceAsStream("/web/data/seed.json")) {
            return Json.read(Objects.requireNonNull(source, "seed.json is missing").readAllBytes(), Seed.class);
        }
    }

    public void plant() {
        var now = Instant.now();
        var today = LocalDate.now(ZoneId.of("Europe/Rome"));
        Database.run(database -> {
            var user = new User(account.name(), account.email(), account.password());
            user.acceptRecoveryKey(account.recoveryKey());
            database.persist(user);
            for (var entry : tasks) database.persist(entry.grow(user.id(), today, now));
            for (var session : focus)
                database.persist(new FocusSession(user.id(), null, session.minutes(), now.minus(session.daysAgo(), ChronoUnit.DAYS)));
        });
    }
}
