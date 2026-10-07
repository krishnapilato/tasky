package io.github.krishnapilato.tasky.core;

import module java.base;
import io.github.krishnapilato.tasky.account.User;
import io.github.krishnapilato.tasky.focus.FocusSession;
import io.github.krishnapilato.tasky.task.Task;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import org.h2.jdbcx.JdbcConnectionPool;
import org.hibernate.boot.model.naming.PhysicalNamingStrategySnakeCaseImpl;
import org.hibernate.cfg.JdbcSettings;
import org.hibernate.cfg.MappingSettings;
import org.hibernate.jpa.HibernatePersistenceConfiguration;
import org.hibernate.tool.schema.Action;

public final class Database {
    private static final LazyConstant<EntityManagerFactory> FACTORY = LazyConstant.of(Database::open);

    private Database() {}

    public static <T> T call(Function<EntityManager, T> work) {
        return FACTORY.get().callInTransaction(work);
    }

    public static void run(Consumer<EntityManager> work) {
        FACTORY.get().runInTransaction(work);
    }

    public static void close() {
        FACTORY.get().close();
    }

    private static EntityManagerFactory open() {
        var pool = JdbcConnectionPool.create("jdbc:h2:mem:tasky;DB_CLOSE_DELAY=-1", "tasky", "");
        return new HibernatePersistenceConfiguration("tasky")
                .managedClasses(User.class, Task.class, FocusSession.class)
                .schemaToolingAction(Action.CREATE)
                .property(JdbcSettings.JAKARTA_NON_JTA_DATASOURCE, pool)
                .property(MappingSettings.PHYSICAL_NAMING_STRATEGY, PhysicalNamingStrategySnakeCaseImpl.class.getName())
                .createEntityManagerFactory();
    }
}
