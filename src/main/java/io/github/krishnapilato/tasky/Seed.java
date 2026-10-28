package io.github.krishnapilato.tasky;

import module java.base;
import com.password4j.Password;
import io.github.krishnapilato.tasky.model.Priority;
import io.github.krishnapilato.tasky.model.Task;
import org.slf4j.LoggerFactory;

record Seed(Account account, List<Entry> tasks) {

    record Account(String name, String email, String password) { }

    record Entry(String title, String notes, Priority priority, Integer dueIn, boolean done) {
        Task on(LocalDate today) {
            return new Task(null, title, notes, dueIn == null ? null : today.plusDays(dueIn), priority, done);
        }
    }

    static void load() throws IOException {
        try (var file = Objects.requireNonNull(Seed.class.getResourceAsStream("/web/data/seed.json"), "seed.json is missing")) {
            var seed = Routes.JSON.readValue(file, Seed.class);
            var today = LocalDate.now(ZoneId.of("Europe/Rome"));
            var user = Store.addUser(seed.account.name(), seed.account.email(), Password.hash(seed.account.password()).addRandomSalt().withArgon2().getResult());
            seed.tasks.forEach(entry -> Store.addTask(user.id(), entry.on(today)));
            LoggerFactory.getLogger(Seed.class).info("Loaded the demo account {} with {} tasks", user.email(), seed.tasks.size());
        }
    }
}