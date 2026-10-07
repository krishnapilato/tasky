package io.github.krishnapilato.tasky.account;

import module java.base;
import io.github.krishnapilato.tasky.core.Database;
import io.github.krishnapilato.tasky.core.Problem;
import jakarta.persistence.EntityManager;

public final class Accounts {
    public record Registration(String name, String email, String password) {
        public Registration {
            name = named(name);
            email = normalized(email);
            if (!EMAIL.matcher(email).matches()) throw new Problem(422, "Enter a valid email address");
            strong(password);
        }
    }

    public record Credentials(String email, String password) {
        public Credentials {
            email = normalized(email);
            password = Objects.requireNonNullElse(password, "");
        }
    }

    public record Recovery(String email, String recoveryKey, String password) {
        public Recovery {
            email = normalized(email);
            recoveryKey = Objects.requireNonNullElse(recoveryKey, "");
            strong(password);
        }
    }

    public record PasswordChange(String current, String next) {
        public PasswordChange {
            current = Objects.requireNonNullElse(current, "");
            strong(next);
        }
    }

    public record Profile(String name) {
        public Profile {
            name = named(name);
        }
    }

    public record RecoveryKey(String recoveryKey) {
    }

    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s]+\\.[^@\\s]+");

    private Accounts() {
    }

    public static User register(Registration registration) {
        return Database.call(database -> {
            if (find(database, registration.email()).isPresent())
                throw new Problem(409, "An account with this email already exists");
            var user = new User(registration.name(), registration.email(), registration.password());
            database.persist(user);
            return user;
        });
    }

    public static User login(Credentials credentials) {
        return Throttle.attempt(credentials.email(), () -> Database.call(database -> find(database, credentials.email())
                .filter(user -> user.hasPassword(credentials.password()))
                .orElseThrow(() -> new Problem(401, "Email or password is incorrect"))));
    }

    public static User recover(Recovery recovery) {
        return Throttle.attempt(recovery.email(), () -> Database.call(database -> {
            var user = find(database, recovery.email())
                    .filter(candidate -> candidate.hasRecoveryKey(recovery.recoveryKey()))
                    .orElseThrow(() -> new Problem(401, "Email or recovery key is incorrect"));
            user.changePassword(recovery.password());
            user.revokeRecoveryKey();
            return user;
        }));
    }

    public static Optional<User> authenticate(String token) {
        return Tokens.verify(token).flatMap(claims -> Database.call(database -> Optional.ofNullable(database.find(User.class, claims.userId())))
                .filter(user -> user.sessionEpoch() == claims.epoch()));
    }

    public static Optional<User> current() {
        return Session.active().map(session -> Database.call(database -> database.find(User.class, session.userId())));
    }

    public static User rename(Profile profile) {
        return Database.call(database -> {
            var user = current(database);
            user.rename(profile.name());
            return user;
        });
    }

    public static User changePassword(PasswordChange change) {
        return Database.call(database -> {
            var user = current(database);
            if (!user.hasPassword(change.current())) throw new Problem(403, "Current password is incorrect");
            user.changePassword(change.next());
            return user;
        });
    }

    public static RecoveryKey issueRecoveryKey() {
        return Database.call(database -> new RecoveryKey(current(database).issueRecoveryKey()));
    }

    private static User current(EntityManager database) {
        return database.find(User.class, Session.current().userId());
    }

    private static Optional<User> find(EntityManager database, String email) {
        return Optional.ofNullable(database.createQuery("select u from User u where u.email = :email", User.class)
                .setParameter("email", email)
                .getSingleResultOrNull());
    }

    private static String normalized(String email) {
        return Objects.requireNonNullElse(email, "").strip().toLowerCase(Locale.ROOT);
    }

    private static String named(String name) {
        var clean = Objects.requireNonNullElse(name, "").strip();
        if (clean.isEmpty() || clean.length() > 80) throw new Problem(422, "Enter a name of up to 80 characters");
        return clean;
    }

    private static void strong(String password) {
        if (password == null || password.length() < 8)
            throw new Problem(422, "Use at least 8 characters for the password");
        if (password.length() > 128) throw new Problem(422, "Keep the password under 128 characters");
    }
}
