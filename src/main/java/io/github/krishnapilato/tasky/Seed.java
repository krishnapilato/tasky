package io.github.krishnapilato.tasky;

import io.github.krishnapilato.tasky.model.Priority;
import io.github.krishnapilato.tasky.model.Task;
import io.github.krishnapilato.tasky.model.TaskData;
import io.github.krishnapilato.tasky.model.User;

import java.io.IOException;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

public record Seed(Account account, List<Entry> tasks) {

    public record Account(String name, String email, String password) { }

    public record Entry(String title, String notes, Priority priority, Integer dueIn, boolean done) {
        TaskData on(LocalDate today) {
            return new TaskData(null, title, notes, dueIn == null ? null : today.plusDays(dueIn), priority, done);
        }
    }

    public static void load() throws IOException {
        try (var file = Seed.class.getResourceAsStream("/web/data/seed.json")) {
            var seed = Json.MAPPER.readValue(file, Seed.class);
            var today = LocalDate.now(ZoneId.of("Europe/Rome"));
            Database.run(database -> {
                var user = new User(seed.account.name(), seed.account.email(), Passwords.hash(seed.account.password()));
                database.persist(user);
                for (var entry : seed.tasks) database.persist(new Task(user.id(), entry.on(today)));
            });
        }
    }
}
