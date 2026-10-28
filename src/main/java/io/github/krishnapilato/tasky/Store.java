package io.github.krishnapilato.tasky;

import module java.base;
import io.github.krishnapilato.tasky.model.Task;
import io.github.krishnapilato.tasky.model.User;
import org.h2.jdbcx.JdbcConnectionPool;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.mapper.reflect.ConstructorMapper;

final class Store {

    private static final String OWNER = "owner";

    private static final String SCHEMA = """
            create table users (
                id bigint auto_increment primary key,
                name varchar(80) not null,
                email varchar(254) not null unique,
                password_hash varchar(255) not null
            );
            create table tasks (
                id bigint auto_increment primary key,
                owner_id bigint not null references users (id),
                title varchar(200) not null,
                notes varchar(2000) not null,
                due date,
                priority varchar(6) not null,
                done boolean not null
            );
            """;

    private static final Jdbi DB = Jdbi.create(JdbcConnectionPool.create("jdbc:h2:mem:tasky;DB_CLOSE_DELAY=-1", "tasky", ""))
            .registerRowMapper(ConstructorMapper.factory(User.class))
            .registerRowMapper(ConstructorMapper.factory(Task.class));

    static { DB.useHandle(handle -> handle.createScript(SCHEMA).execute()); }

    private Store() {}

    static Optional<User> user(long id) {
        return DB.withHandle(handle -> handle.createQuery("select * from users where id = :id").bind("id", id).mapTo(User.class).findOne());
    }

    static Optional<User> userByEmail(String email) {
        return DB.withHandle(handle -> handle.createQuery("select * from users where email = :email").bind("email", email).mapTo(User.class).findOne());
    }

    static User addUser(String name, String email, String passwordHash) {
        long id = DB.withHandle(handle -> handle.createUpdate("insert into users (name, email, password_hash) values (:name, :email, :hash)")
                .bind("name", name)
                .bind("email", email)
                .bind("hash", passwordHash)
                .executeAndReturnGeneratedKeys("id")
                .mapTo(Long.class)
                .one());
        return new User(id, name, email, passwordHash);
    }

    static List<Task> tasks(long owner) {
        return DB.withHandle(handle -> handle.createQuery("select id, title, notes, due, priority, done from tasks where owner_id = :owner order by id")
                .bind(OWNER, owner)
                .mapTo(Task.class)
                .list());
    }

    static Optional<Task> task(long owner, long id) {
        return DB.withHandle(handle -> handle.createQuery("select id, title, notes, due, priority, done from tasks where id = :id and owner_id = :owner")
                .bind("id", id)
                .bind(OWNER, owner)
                .mapTo(Task.class)
                .findOne());
    }

    static Task addTask(long owner, Task task) {
        long id = DB.withHandle(handle -> handle.createUpdate("insert into tasks (owner_id, title, notes, due, priority, done) values (:owner, :title, :notes, :due, :priority, :done)")
                .bind(OWNER, owner)
                .bindMethods(task)
                .executeAndReturnGeneratedKeys("id")
                .mapTo(Long.class)
                .one());
        return task.withId(id);
    }

    static Optional<Task> updateTask(long owner, long id, Task task) {
        int changed = DB.withHandle(handle -> handle.createUpdate("update tasks set title = :title, notes = :notes, due = :due, priority = :priority, done = :done where id = :taskId and owner_id = :owner")
                .bind(OWNER, owner)
                .bind("taskId", id)
                .bindMethods(task)
                .execute());
        return changed == 1 ? Optional.of(task.withId(id)) : Optional.empty();
    }

    static boolean deleteTask(long owner, long id) {
        return DB.withHandle(handle -> handle.createUpdate("delete from tasks where id = :id and owner_id = :owner").bind("id", id).bind(OWNER, owner).execute()) == 1;
    }
}