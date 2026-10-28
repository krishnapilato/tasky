package io.github.krishnapilato.tasky;

import module java.base;
import com.password4j.Password;
import io.github.krishnapilato.tasky.model.Task;
import io.github.krishnapilato.tasky.model.User;
import io.javalin.config.JavalinConfig;
import io.javalin.http.Context;
import io.javalin.http.HttpResponseException;
import io.javalin.http.staticfiles.Location;
import io.javalin.json.JavalinJackson3;
import jakarta.servlet.http.HttpSession;
import org.eclipse.jetty.http.HttpCookie;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.cfg.EnumFeature;
import tools.jackson.databind.json.JsonMapper;

final class Routes {

    static final JsonMapper JSON = JsonMapper.builder()
            .enable(EnumFeature.WRITE_ENUMS_TO_LOWERCASE)
            .enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
            .build();

    private static final Logger LOG = LoggerFactory.getLogger(Routes.class);
    private static final String USER_ID = "userId";
    private static final String MESSAGE = "message";
    private static final String UNREADABLE = "The request could not be read";
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s.]+(\\.[^@\\s.]+)+");
    private static final Pattern TASK_ID = Pattern.compile("\\d{1,18}");
    private static final int MAX_FAILED_LOGINS = 8;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(10);
    private static final Map<String, List<Instant>> FAILED_LOGINS = new ConcurrentHashMap<>();

    record Form(String name, String email, String password) { }

    record Account(boolean demo, User.View user) { }

    private Routes() {}

    static void configure(JavalinConfig config) {
        config.startup.showJavalinBanner = false;
        config.concurrency.useVirtualThreads = true;
        config.http.maxRequestSize = 16_384;
        config.jsonMapper(new JavalinJackson3(JSON, false));
        config.staticFiles.add(files -> {
            files.hostedPath = "/";
            files.directory = "/web";
            files.location = Location.CLASSPATH;
            // Force revalidation so a cached old app.js never runs against a newer index.html.
            files.headers = Map.of("Cache-Control", "no-cache");
        });
        config.jetty.modifyServletContextHandler(context -> context.getSessionHandler().setSameSite(HttpCookie.SameSite.STRICT));
        config.requestLogger.http((ctx, millis) -> {
            if (ctx.path().startsWith("/api/")) LOG.info("{} {} {} in {} ms", ctx.method(), ctx.path(), ctx.statusCode(), Math.round(millis));
        });

        config.routes.before(Routes::secure);
        config.routes.exception(HttpResponseException.class, (failure, ctx) -> ctx.status(failure.getStatus()).json(Map.of(MESSAGE, failure.getMessage())));
        config.routes.exception(JacksonException.class, (_, ctx) -> ctx.status(400).json(Map.of(MESSAGE, UNREADABLE)));
        config.routes.exception(Exception.class, (failure, ctx) -> {
            LOG.error("{} {} failed", ctx.method(), ctx.path(), failure);
            ctx.status(500).json(Map.of(MESSAGE, "Something went wrong on the server"));
        });

        config.routes.get("/api/account", ctx -> ctx.json(new Account(false, signedIn(ctx).flatMap(Store::user).map(User::view).orElse(null))));
        config.routes.post("/api/account/register", ctx -> signIn(ctx, register(body(ctx, Form.class))));
        config.routes.post("/api/account/login", ctx -> signIn(ctx, login(body(ctx, Form.class))));
        config.routes.post("/api/account/logout", Routes::signOut);
        config.routes.get("/api/tasks", ctx -> ctx.json(Store.tasks(userId(ctx))));
        config.routes.post("/api/tasks", ctx -> ctx.status(201).json(Store.addTask(userId(ctx), checked(body(ctx, Task.class), null))));
        config.routes.put("/api/tasks/{id}", Routes::update);
        config.routes.delete("/api/tasks/{id}", Routes::delete);
    }

    private static void secure(Context ctx) {
        ctx.header("X-Content-Type-Options", "nosniff");
        ctx.header("X-Frame-Options", "DENY");
        ctx.header("Referrer-Policy", "no-referrer");
        ctx.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    }

    private static <T> T body(Context ctx, Class<T> type) {
        return Optional.ofNullable(ctx.bodyAsClass(type)).orElseThrow(() -> new HttpResponseException(400, UNREADABLE));
    }

    private static User register(Form form) {
        var name = text(form.name());
        var email = text(form.email()).toLowerCase(Locale.ROOT);
        if (name.isEmpty() || name.length() > 80) throw new HttpResponseException(422, "Enter your name");
        if (!EMAIL.matcher(email).matches()) throw new HttpResponseException(422, "Enter a valid email address");
        if (text(form.password()).length() < 8) throw new HttpResponseException(422, "Use at least 8 characters for the password");
        if (Store.userByEmail(email).isPresent()) throw new HttpResponseException(409, "An account with this email already exists");
        return Store.addUser(name, email, Password.hash(form.password()).addRandomSalt().withArgon2().getResult());
    }

    private static User login(Form form) {
        var email = text(form.email()).toLowerCase(Locale.ROOT);
        var since = Instant.now().minus(LOGIN_WINDOW);
        var failures = FAILED_LOGINS.getOrDefault(email, List.of()).stream().filter(since::isBefore).toList();
        if (failures.size() >= MAX_FAILED_LOGINS) throw new HttpResponseException(429, "Too many attempts. Try again in a few minutes");
        var user = Store.userByEmail(email).filter(found -> form.password() != null && Password.check(form.password(), found.passwordHash()).withArgon2());
        user.ifPresentOrElse(_ -> FAILED_LOGINS.remove(email), () -> FAILED_LOGINS.put(email, Stream.concat(failures.stream(), Stream.of(Instant.now())).toList()));
        return user.orElseThrow(() -> new HttpResponseException(401, "Email or password is incorrect."));
    }

    private static void signIn(Context ctx, User user) {
        ctx.req().getSession(true);
        ctx.req().changeSessionId();
        ctx.req().getSession().setAttribute(USER_ID, user.id());
        ctx.json(user.view());
    }

    private static void signOut(Context ctx) {
        Optional.ofNullable(ctx.req().getSession(false)).ifPresent(HttpSession::invalidate);
        ctx.status(204);
    }

    private static void update(Context ctx) {
        var owner = userId(ctx);
        var id = taskId(ctx);
        var current = Store.task(owner, id).orElseThrow(Routes::missing);
        ctx.json(Store.updateTask(owner, id, checked(body(ctx, Task.class), current.due())).orElseThrow(Routes::missing));
    }

    private static void delete(Context ctx) {
        if (!Store.deleteTask(userId(ctx), taskId(ctx))) throw missing();
        ctx.status(204);
    }

    private static Optional<Long> signedIn(Context ctx) {
        return Optional.ofNullable(ctx.req().getSession(false)).map(session -> (Long) session.getAttribute(USER_ID));
    }

    private static long userId(Context ctx) {
        return signedIn(ctx).orElseThrow(() -> new HttpResponseException(401, "Sign in to continue"));
    }

    private static long taskId(Context ctx) {
        var id = ctx.pathParam("id");
        if (!TASK_ID.matcher(id).matches()) throw missing();
        return Long.parseLong(id);
    }

    private static Task checked(Task task, LocalDate currentDue) {
        if (task.title().isEmpty()) throw new HttpResponseException(422, "Give the task a title");
        if (task.title().length() > 200) throw new HttpResponseException(422, "Keep the title under 200 characters");
        if (task.notes().length() > 2000) throw new HttpResponseException(422, "Keep the notes under 2000 characters");
        if (task.due() != null && !task.due().equals(currentDue) && task.due().isBefore(earliestToday())) throw new HttpResponseException(422, "Pick today or a later date");
        return task;
    }

    // The browser picks dates in its own time zone, which can be up to one day behind UTC.
    private static LocalDate earliestToday() {
        return LocalDate.now(ZoneOffset.UTC).minusDays(1);
    }

    private static HttpResponseException missing() {
        return new HttpResponseException(404, "Task not found");
    }

    private static String text(String value) {
        return value == null ? "" : value.strip();
    }
}
