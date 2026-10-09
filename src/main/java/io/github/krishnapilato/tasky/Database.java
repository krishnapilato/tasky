package io.github.krishnapilato.tasky;

import io.github.krishnapilato.tasky.model.Task;
import io.github.krishnapilato.tasky.model.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.h2.jdbcx.JdbcConnectionPool;
import org.hibernate.cfg.JdbcSettings;
import org.hibernate.jpa.HibernatePersistenceConfiguration;
import org.hibernate.tool.schema.Action;

import java.util.function.Consumer;
import java.util.function.Function;

public final class Database {

    private static final EntityManagerFactory FACTORY = new HibernatePersistenceConfiguration("tasky")
            .managedClasses(User.class, Task.class)
            .schemaToolingAction(Action.CREATE)
            .property(JdbcSettings.JAKARTA_NON_JTA_DATASOURCE, JdbcConnectionPool.create("jdbc:h2:mem:tasky;DB_CLOSE_DELAY=-1", "tasky", ""))
            .createEntityManagerFactory();

    private Database() {}

    public static <T> T call(Function<EntityManager, T> work) {
        return FACTORY.callInTransaction(work);
    }

    public static void run(Consumer<EntityManager> work) {
        FACTORY.runInTransaction(work);
    }
}
