package io.github.krishnapilato.tasky;

import io.github.krishnapilato.tasky.model.*;
import org.apache.logging.log4j.LogManager;

import java.io.IOException;
import java.time.*;
import java.util.List;
import java.util.Objects;

record Seed(Account account, List<Entry> tasks) {

    record Account(String name, String email, String password) { }

    record Entry(String title, String notes, Priority priority, Integer dueIn, boolean done) {
        TaskData on(LocalDate today) {
            return new TaskData(null, title, notes, dueIn == null ? null : today.plusDays(dueIn), priority, done);
        }
    }

    static void load() throws IOException {
        var seed = Json.MAPPER.readValue(Objects.requireNonNull(Seed.class.getResource("/web/data/seed.json")).openStream(), Seed.class);

        Database.run(db -> {
            var user = new User(seed.account().name(), seed.account().email(), Passwords.hash(seed.account().password()));
            db.persist(user);
            seed.tasks().forEach(t -> db.persist(new Task(user.id(), t.on(LocalDate.now(ZoneId.of("Europe/Rome"))))));
        });
        LogManager.getLogger(Seed.class).info("Loaded the demo account {} with {} tasks into the in-memory database", seed.account().email(), seed.tasks().size());
    }
}