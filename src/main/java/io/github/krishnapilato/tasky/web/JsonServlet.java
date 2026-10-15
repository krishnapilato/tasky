package io.github.krishnapilato.tasky.web;

import io.github.krishnapilato.tasky.Json;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import tools.jackson.core.JacksonException;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

public abstract class JsonServlet extends HttpServlet {

    protected static final String USER_ID = "userId";
    private static final Logger LOG = LogManager.getLogger(JsonServlet.class);

    @Override
    protected void service(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        var started = System.nanoTime();
        var outcome = "";
        try {
            super.service(request, response);
        } catch (Problem problem) {
            outcome = " - " + problem.getMessage();
            send(response, problem.status(), Map.of("message", problem.getMessage()));
        } catch (RuntimeException failure) {
            LOG.error("{} {} failed", request.getMethod(), request.getRequestURI(), failure);
            send(response, 500, Map.of("message", "Something went wrong on the server"));
        }
        LOG.info("{} {} {} in {} ms{}", request.getMethod(), request.getRequestURI(), response.getStatus(), (System.nanoTime() - started) / 1_000_000, outcome);
    }

    protected <T> T read(HttpServletRequest request, Class<T> type) throws IOException {
        try {
            return Objects.requireNonNull(Json.MAPPER.readValue(request.getInputStream(), type));
        } catch (JacksonException | NullPointerException unreadable) {
            throw new Problem(400, "The request could not be read");
        }
    }

    protected void send(HttpServletResponse response, int status, Object body) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        Json.MAPPER.writeValue(response.getOutputStream(), body);
    }

    protected Optional<Long> signedIn(HttpServletRequest request) {
        return Optional.ofNullable(request.getSession(false)).map(session -> (Long) session.getAttribute(USER_ID));
    }

    protected long userId(HttpServletRequest request) {
        return signedIn(request).orElseThrow(() -> new Problem(401, "Sign in to continue"));
    }

    protected static String text(String value) {
        return value == null ? "" : value.strip();
    }
}