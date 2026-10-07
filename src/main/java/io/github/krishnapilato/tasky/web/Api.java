package io.github.krishnapilato.tasky.web;

import module java.base;
import io.github.krishnapilato.tasky.account.Accounts;
import io.github.krishnapilato.tasky.account.Accounts.*;
import io.github.krishnapilato.tasky.account.Session;
import io.github.krishnapilato.tasky.account.Tokens;
import io.github.krishnapilato.tasky.account.User;
import io.github.krishnapilato.tasky.core.Json;
import io.github.krishnapilato.tasky.core.Problem;
import io.github.krishnapilato.tasky.focus.FocusLog;
import io.github.krishnapilato.tasky.insight.Insights;
import io.github.krishnapilato.tasky.task.TaskDraft;
import io.github.krishnapilato.tasky.task.Tasks;
import io.github.krishnapilato.tasky.web.Reply.*;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Api extends HttpServlet {

    public record Meta(String name, String version, int java, String storage) { }

    private record Hit(Route route, Map<String, String> path) { }

    private static final Logger LOG = LoggerFactory.getLogger(Api.class);
    private static final String COOKIE = "tasky_session";
    private static final LazyConstant<Meta> META = LazyConstant.of(() -> new Meta(
            "Tasky",
            Objects.requireNonNullElse(Api.class.getPackage().getImplementationVersion(), "dev"),
            Runtime.version().feature(),
            "H2 in-memory"));

    private final transient List<Route> routes = List.of(
            new Route("GET", "/meta", _ -> new Ok(META.get())),
            new Route("GET", "/auth/key", _ -> new Text("application/x-pem-file", Tokens.publicKeyPem())),
            new Route("POST", "/auth/register", exchange -> new Created(signIn(exchange, Accounts.register(exchange.body(Registration.class))))),
            new Route("POST", "/auth/login", exchange -> new Ok(signIn(exchange, Accounts.login(exchange.body(Credentials.class))))),
            new Route("POST", "/auth/recover", exchange -> new Ok(signIn(exchange, Accounts.recover(exchange.body(Recovery.class))))),
            new Route("POST", "/auth/password", exchange -> new Ok(signIn(exchange, Accounts.changePassword(exchange.body(PasswordChange.class))))),
            new Route("POST", "/auth/logout", Api::signOut),
            new Route("POST", "/auth/recovery-key", _ -> new Ok(Accounts.issueRecoveryKey())),
            new Route("GET", "/auth/me", _ -> Reply.of(Accounts.current().map(User::view))),
            new Route("PUT", "/auth/me", exchange -> new Ok(Accounts.rename(exchange.body(Profile.class)).view())),
            new Route("GET", "/tasks", _ -> new Ok(Tasks.list())),
            new Route("POST", "/tasks", exchange -> new Created(Tasks.create(exchange.body(TaskDraft.class)))),
            new Route("PUT", "/tasks/{id}", exchange -> new Ok(Tasks.edit(exchange.id(), exchange.body(TaskDraft.class)))),
            new Route("POST", "/tasks/{id}/move", exchange -> new Ok(Tasks.move(exchange.id(), exchange.body(Tasks.Move.class).status()))),
            new Route("DELETE", "/tasks/{id}", Api::delete),
            new Route("POST", "/focus", exchange -> Reply.of(FocusLog.record(exchange.body(FocusLog.Entry.class)))),
            new Route("GET", "/insights", _ -> new Ok(Insights.summarize())));

    @Override
    protected void service(HttpServletRequest request, HttpServletResponse response) throws IOException {
        send(response, answer(request, response));
    }

    private Reply answer(HttpServletRequest request, HttpServletResponse response) {
        try {
            var hit = find(request.getMethod(), Objects.requireNonNullElse(request.getPathInfo(), "/"));
            var exchange = new Exchange(request, response, hit.path());
            return exchange.cookie(COOKIE)
                    .flatMap(Accounts::authenticate)
                    .map(user -> new Session(user.id(), exchange.zone()).call(() -> hit.route().handler().apply(exchange)))
                    .orElseGet(() -> hit.route().handler().apply(exchange));
        } catch (Problem problem) {
            return new Failed(problem.status(), problem.getMessage());
        } catch (RuntimeException failure) {
            LOG.error("{} {} failed", request.getMethod(), request.getRequestURI(), failure);
            return new Failed(500, "Something went wrong on the server");
        }
    }

    private Hit find(String method, String path) {
        var reachable = routes.stream()
                .flatMap(route -> route.match(path).map(values -> new Hit(route, values)).stream())
                .toList();
        if (reachable.isEmpty()) throw new Problem(404, "No such endpoint");
        return reachable.stream()
                .filter(hit -> hit.route().method().equals(method))
                .findFirst()
                .orElseThrow(() -> new Problem(405, "This endpoint does not support " + method));
    }

    private static void send(HttpServletResponse response, Reply reply) throws IOException {
        response.setHeader("Cache-Control", "no-store");
        switch (reply) {
            case Ok(var body) -> json(response, 200, body);
            case Created(var body) -> json(response, 201, body);
            case Failed(var status, var message) -> json(response, status, Map.of("message", message));
            case NoContent() -> response.setStatus(204);
            case Text(var contentType, var body) -> {
                response.setContentType(contentType);
                response.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
    }

    private static void json(HttpServletResponse response, int status, Object body) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        Json.write(response.getOutputStream(), body);
    }

    private static User.View signIn(Exchange exchange, User user) {
        exchange.cookie(COOKIE, Tokens.issue(user.id(), user.sessionEpoch()), Tokens.LIFETIME);
        return user.view();
    }

    private static Reply signOut(Exchange exchange) {
        exchange.cookie(COOKIE, "", Duration.ZERO);
        return new NoContent();
    }

    private static Reply delete(Exchange exchange) {
        Tasks.delete(exchange.id());
        return new NoContent();
    }
}
