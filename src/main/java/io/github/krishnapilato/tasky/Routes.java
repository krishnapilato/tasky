package io.github.krishnapilato.tasky;

import module java.base;
import com.password4j.Password;
import io.github.krishnapilato.tasky.model.Task;
import io.github.krishnapilato.tasky.model.User;
import io.javalin.config.JavalinConfig;
import io.javalin.http.BadRequestResponse;
import io.javalin.http.ConflictResponse;
import io.javalin.http.Context;
import io.javalin.http.ForbiddenResponse;
import io.javalin.http.HttpResponseException;
import io.javalin.http.HttpStatus;
import io.javalin.http.NotFoundResponse;
import io.javalin.http.TooManyRequestsResponse;
import io.javalin.http.UnauthorizedResponse;
import io.javalin.http.UnprocessableContentResponse;
import io.javalin.http.UnsupportedMediaTypeResponse;
import io.javalin.http.staticfiles.Location;
import io.javalin.json.JavalinJackson3;
import jakarta.servlet.http.HttpSession;
import org.eclipse.jetty.http.HttpCookie;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.cfg.EnumFeature;
import tools.jackson.databind.cfg.CoercionAction;
import tools.jackson.databind.cfg.CoercionInputShape;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.type.LogicalType;

public final class Routes {

    static final JsonMapper JSON = JsonMapper.builder()
            .enable(EnumFeature.WRITE_ENUMS_TO_LOWERCASE)
            .enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS)
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS)
            .withCoercionConfig(LogicalType.Textual, coercion -> {
                coercion.setCoercion(CoercionInputShape.Integer, CoercionAction.Fail);
                coercion.setCoercion(CoercionInputShape.Float, CoercionAction.Fail);
                coercion.setCoercion(CoercionInputShape.Boolean, CoercionAction.Fail);
            })
            .build();

    static final ZoneId DEFAULT_ZONE = ZoneId.of("Europe/Rome");

    private static final Logger LOG = LoggerFactory.getLogger(Routes.class);
    private static final String USER_ID = "userId";
    private static final String MESSAGE = "message";
    private static final String UNREADABLE = "The request could not be read";
    private static final String NOT_ALLOWED = "Request not allowed";
    private static final String WRONG_LOGIN = "Email or password is incorrect.";
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> BODY_METHODS = Set.of("POST", "PUT");
    private static final Set<String> SAME_SITE = Set.of("same-origin", "none");
    private static final Pattern EMAIL = Pattern.compile("[^@\\s]+@[^@\\s.]++(?:\\.[^@\\s.]++)++");
    private static final Pattern TASK_ID = Pattern.compile("\\d{1,18}");
    private static final int MAX_FAILED_LOGINS = 8;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(10);
    private static final Map<String, List<Instant>> FAILED_LOGINS = new ConcurrentHashMap<>();
    // Checked when the email is unknown, so the response time does not reveal which accounts exist.
    private static final String UNKNOWN_USER_HASH = hash(UUID.randomUUID().toString());

    public record Form(String name, String email, String password) { }

    public record Account(boolean demo, User.View user) { }

    private Routes() {}

    public static void configure(JavalinConfig config) {
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
        config.routes.exception(JacksonException.class, (_, ctx) -> ctx.status(HttpStatus.BAD_REQUEST).json(Map.of(MESSAGE, UNREADABLE)));
        config.routes.exception(Exception.class, (failure, ctx) -> {
            LOG.error("{} {} failed", ctx.method(), ctx.path(), failure);
            ctx.status(HttpStatus.INTERNAL_SERVER_ERROR).json(Map.of(MESSAGE, "Something went wrong on the server"));
        });

        config.routes.get("/api/account", ctx -> ctx.json(new Account(false, signedIn(ctx).flatMap(Store::user).map(User::view).orElse(null))));
        config.routes.post("/api/account/register", ctx -> signIn(ctx, register(body(ctx, Form.class))));
        config.routes.post("/api/account/login", ctx -> signIn(ctx, login(body(ctx, Form.class))));
        config.routes.post("/api/account/logout", Routes::signOut);
        config.routes.get("/api/tasks", ctx -> ctx.json(Store.tasks(userId(ctx))));
        config.routes.post("/api/tasks", ctx -> ctx.status(HttpStatus.CREATED).json(Store.addTask(userId(ctx), checked(body(ctx, Task.class), null, today(ctx)))));
        config.routes.put("/api/tasks/{id}", Routes::update);
        config.routes.delete("/api/tasks/{id}", Routes::delete);
    }

    static String hash(String password) {
        return Password.hash(password).addRandomSalt().withArgon2().getResult();
    }

    private static void secure(Context ctx) {
        ctx.header("X-Content-Type-Options", "nosniff");
        ctx.header("X-Frame-Options", "DENY");
        ctx.header("Referrer-Policy", "no-referrer");
        ctx.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        if (!ctx.path().startsWith("/api/")) return;
        ctx.header("Cache-Control", "no-store");
        var method = ctx.method().name();
        if (SAFE_METHODS.contains(method)) return;
        if (!"1".equals(ctx.header("X-Tasky-Request"))) throw new ForbiddenResponse(NOT_ALLOWED);
        var origin = ctx.header("Origin");
        if (origin != null && !origin.equals(ctx.scheme() + "://" + ctx.host())) throw new ForbiddenResponse(NOT_ALLOWED);
        var site = ctx.header("Sec-Fetch-Site");
        if (site != null && !SAME_SITE.contains(site)) throw new ForbiddenResponse(NOT_ALLOWED);
        var type = Optional.ofNullable(ctx.contentType()).orElse("").split(";", 2)[0].strip();
        if (BODY_METHODS.contains(method) && !"application/json".equalsIgnoreCase(type)) throw new UnsupportedMediaTypeResponse("Send requests as application/json");
    }

    private static <T> T body(Context ctx, Class<T> type) {
        return Optional.ofNullable(JSON.readValue(ctx.body(), type)).orElseThrow(() -> new BadRequestResponse(UNREADABLE));
    }

    private static User register(Form form) {
        var name = text(form.name());
        var email = text(form.email()).toLowerCase(Locale.ROOT);
        var password = Objects.requireNonNullElse(form.password(), "");

        if (name.isEmpty() || name.length() > 80) throw new UnprocessableContentResponse("Enter your name.");
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) throw new UnprocessableContentResponse("Enter a valid email address.");
        // Surrounding spaces do not count toward the minimum, but the password is stored exactly as typed.
        if (password.strip().length() < 8) throw new UnprocessableContentResponse("Use at least 8 characters for the password.");
        if (password.length() > 1024) throw new UnprocessableContentResponse("Keep the password under 1024 characters.");

        return Store.addUser(name, email, hash(password)).orElseThrow(() -> new ConflictResponse("An account with this email already exists."));
    }

    private static User login(Form form) {
        var email = text(form.email()).toLowerCase(Locale.ROOT);
        var password = form.password();
        if (email.length() > 254 || !EMAIL.matcher(email).matches() || password == null || password.length() > 1024) throw new UnauthorizedResponse(WRONG_LOGIN);

        var since = Instant.now().minus(LOGIN_WINDOW);
        FAILED_LOGINS.entrySet().removeIf(entry -> entry.getValue().stream().noneMatch(since::isBefore));
        if (FAILED_LOGINS.getOrDefault(email, List.of()).stream().filter(since::isBefore).count() >= MAX_FAILED_LOGINS) throw new TooManyRequestsResponse("Too many attempts. Try again in a few minutes");

        var user = Store.userByEmail(email);
        var valid = Password.check(password, user.map(User::passwordHash).orElse(UNKNOWN_USER_HASH)).withArgon2();
        var match = user.filter(_ -> valid);
        if (match.isPresent()) FAILED_LOGINS.remove(email);
        else FAILED_LOGINS.merge(email, List.of(Instant.now()), (old, added) -> Stream.concat(old.stream().filter(since::isBefore), added.stream()).toList());
        return match.orElseThrow(() -> new UnauthorizedResponse(WRONG_LOGIN));
    }

    private static void signIn(Context ctx, User user) {
        ctx.req().getSession(true);
        ctx.req().changeSessionId();
        ctx.req().getSession().setAttribute(USER_ID, user.id());
        ctx.req().getSession().setMaxInactiveInterval(1800);
        ctx.json(user.view());
    }

    private static void signOut(Context ctx) {
        Optional.ofNullable(ctx.req().getSession(false)).ifPresent(HttpSession::invalidate);
        ctx.status(HttpStatus.NO_CONTENT);
    }

    private static void update(Context ctx) {
        var owner = userId(ctx);
        var id = taskId(ctx);
        var current = Store.task(owner, id).orElseThrow(Routes::missing);
        ctx.json(Store.updateTask(owner, id, checked(body(ctx, Task.class), current.due(), today(ctx))).orElseThrow(Routes::missing));
    }

    private static void delete(Context ctx) {
        if (!Store.deleteTask(userId(ctx), taskId(ctx))) throw missing();
        ctx.status(HttpStatus.NO_CONTENT);
    }

    private static Optional<Long> signedIn(Context ctx) {
        return Optional.ofNullable(ctx.req().getSession(false)).map(session -> (Long) session.getAttribute(USER_ID));
    }

    private static long userId(Context ctx) {
        return signedIn(ctx).orElseThrow(() -> new UnauthorizedResponse("Sign in to continue"));
    }

    private static long taskId(Context ctx) {
        var id = ctx.pathParam("id");
        if (!TASK_ID.matcher(id).matches()) throw missing();
        return Long.parseLong(id);
    }

    private static Task checked(Task task, LocalDate currentDue, LocalDate today) {
        if (task.due() != null && (task.due().getYear() < 1 || task.due().getYear() > 9999)) throw new BadRequestResponse(UNREADABLE);
        if (task.title().isEmpty()) throw new UnprocessableContentResponse("Give the task a title.");
        if (task.title().length() > 50) throw new UnprocessableContentResponse("Keep the title under 50 characters.");
        if (task.notes().length() > 150) throw new UnprocessableContentResponse("Keep the notes under 150 characters.");
        if (task.due() != null && !task.due().equals(currentDue) && task.due().isBefore(today)) throw new UnprocessableContentResponse("Pick today or a later date.");

        return task;
    }

    // Date inputs represent a calendar day in the browser's time zone.
    private static LocalDate today(Context ctx) {
        try {
            return LocalDate.now(Optional.ofNullable(ctx.header("X-Time-Zone")).map(ZoneId::of).orElse(DEFAULT_ZONE));
        } catch (DateTimeException _) {
            throw new BadRequestResponse(UNREADABLE);
        }
    }

    private static NotFoundResponse missing() {
        return new NotFoundResponse("Task not found");
    }

    private static String text(String value) {
        return value == null ? "" : value.strip();
    }
}
